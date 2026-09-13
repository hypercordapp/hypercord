/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { FluxDispatcher, RestAPI, Toasts, UserStore } from "@webpack/common";

import { AvailableCandidate, ClaimAction, SniperConfig, SniperLogEntry, SniperMode, SniperStats, SniperTier } from "./types";
import { generateCandidatesForMode } from "./utils/generator";
import { playAlarmBuzzer, playSuccessChime } from "./utils/sound";
import { resolveUserTier, validateModeAccess } from "./utils/tierManager";
import { sendWebhookAlert } from "./utils/webhook";


type Listener<T> = (data: T) => void;

function sendDesktopNotification(title: string, body: string) {
    try {
        if ("Notification" in window) {
            if (Notification.permission === "granted") {
                new Notification(title, { body });
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        new Notification(title, { body });
                    }
                });
            }
        }
    } catch {}
}

class SniperEngine {
    private isRunning = false;
    private shouldStop = false;
    private currentCandidates: string[] = [];
    private currentIndex = 0;
    private logs: SniperLogEntry[] = [];
    private availableList: AvailableCandidate[] = [];
    private startTime = 0;
    private checksInLastMinute = 0;
    private minuteResetTimer: any = null;

    private config: SniperConfig = {
        mode: "4l_letters",
        claimAction: "prompt_modal",
        delayMs: 2200,
        customWordlist: "",
        webhookUrl: "",
        soundAlerts: true,
        autoRestartOnCooldown: true,
        cooldownWaitSeconds: 60,
    };

    private stats: SniperStats = {
        totalChecked: 0,
        availableFound: 0,
        claimedCount: 0,
        rateLimitsHit: 0,
        checksPerMinute: 0,
        isRunning: false,
        currentUsername: "",
    };

    private statsListeners = new Set<Listener<SniperStats>>();
    private logListeners = new Set<Listener<SniperLogEntry[]>>();
    private foundListeners = new Set<Listener<AvailableCandidate>>();
    private promptModalCallback: ((candidate: AvailableCandidate, onConfirm: () => Promise<boolean>) => void) | null = null;

    constructor() {
        this.resetStats();
    }

    public getConfig(): SniperConfig {
        return { ...this.config };
    }

    public updateConfig(newConfig: Partial<SniperConfig>) {
        this.config = { ...this.config, ...newConfig };
    }

    public setPromptModalHandler(cb: (candidate: AvailableCandidate, onConfirm: () => Promise<boolean>) => void) {
        this.promptModalCallback = cb;
    }

    public getStats(): SniperStats {
        return { ...this.stats };
    }

    public getLogs(): SniperLogEntry[] {
        return [...this.logs];
    }

    public getAvailableList(): AvailableCandidate[] {
        return [...this.availableList];
    }

    public subscribeStats(listener: Listener<SniperStats>): () => void {
        this.statsListeners.add(listener);
        listener(this.getStats());
        return () => this.statsListeners.delete(listener);
    }

    public subscribeLogs(listener: Listener<SniperLogEntry[]>): () => void {
        this.logListeners.add(listener);
        listener(this.getLogs());
        return () => this.logListeners.delete(listener);
    }

    public subscribeFound(listener: Listener<AvailableCandidate>): () => void {
        this.foundListeners.add(listener);
        return () => this.foundListeners.delete(listener);
    }

    private emitStats() {
        const statsCopy = this.getStats();
        this.statsListeners.forEach(l => l(statsCopy));
    }

    private emitLogs() {
        const logsCopy = this.getLogs();
        this.logListeners.forEach(l => l(logsCopy));
    }

    public addLog(username: string, status: SniperLogEntry["status"], message?: string) {
        const entry: SniperLogEntry = {
            id: Math.random().toString(36).slice(2, 9),
            timestamp: Date.now(),
            username,
            status,
            message,
        };

        this.logs.unshift(entry);
        if (this.logs.length > 200) {
            this.logs.pop();
        }
        this.emitLogs();
    }

    public resetStats() {
        this.stats = {
            totalChecked: 0,
            availableFound: 0,
            claimedCount: 0,
            rateLimitsHit: 0,
            checksPerMinute: 0,
            isRunning: this.isRunning,
            currentUsername: "",
        };
        this.logs = [];
        this.availableList = [];
        this.emitStats();
        this.emitLogs();
    }

    /**
     * Start the sniper engine with strict role verification
     */
    public async start(): Promise<boolean> {
        if (this.isRunning) return false;

        const auth = resolveUserTier();
        if (!validateModeAccess(this.config.mode, auth.tier)) {
            const required = this.config.mode.startsWith("3l") || this.config.mode === "custom_wordlist" ? "VIP (250 TL)" : "Destekçi (100 TL)";
            this.addLog(
                "-",
                "error",
                `⛔ YETKİSİZ ERİŞİM: '${this.config.mode}' modunu çalıştırmak için ${required} rolüne sahip olmanız gereklidir!`
            );
            Toasts.show({
                id: Toasts.genId(),
                message: `⛔ Bu özellik için ${required} rolü gereklidir.`,
                type: Toasts.Type.FAILURE,
            });
            return false;
        }

        this.isRunning = true;
        this.shouldStop = false;
        this.stats.isRunning = true;
        this.startTime = Date.now();
        this.checksInLastMinute = 0;

        // Generate candidate username pool
        this.currentCandidates = generateCandidatesForMode(this.config.mode, this.config.customWordlist);
        this.currentIndex = 0;

        if (this.currentCandidates.length === 0) {
            this.addLog("-", "error", "Tarama için geçerli kullanıcı adı listesi bulunamadı!");
            this.stop();
            return false;
        }

        this.addLog(
            "-",
            "info",
            `🚀 Tarama başlatıldı! Yetki: [${auth.tier.toUpperCase()}] | Hedef: ${this.config.mode.toUpperCase()} (${this.currentCandidates.length.toLocaleString()} adet)`
        );

        if (!this.minuteResetTimer) {
            this.minuteResetTimer = setInterval(() => {
                this.stats.checksPerMinute = this.checksInLastMinute;
                this.checksInLastMinute = 0;
                this.emitStats();
            }, 60000);
        }

        this.emitStats();
        this.runLoop();
        return true;
    }

    /**
     * Stop the sniper engine
     */
    public stop() {
        this.isRunning = false;
        this.shouldStop = true;
        this.stats.isRunning = false;
        this.stats.currentUsername = "";
        if (this.minuteResetTimer) {
            clearInterval(this.minuteResetTimer);
            this.minuteResetTimer = null;
        }
        this.addLog("-", "info", "⏹️ Tarama durduruldu.");
        this.emitStats();
    }

    /**
     * Main async scanner loop
     */
    private async runLoop() {
        while (this.isRunning && !this.shouldStop && this.currentIndex < this.currentCandidates.length) {
            const targetUsername = this.currentCandidates[this.currentIndex];
            this.currentIndex++;
            this.stats.currentUsername = targetUsername;
            this.emitStats();

            try {
                const result = await this.checkUsername(targetUsername);

                if (result.status === "available") {
                    this.stats.availableFound++;
                    this.stats.lastFoundUsername = targetUsername;
                    this.stats.lastFoundTime = Date.now();
                    this.emitStats();

                    const candidate: AvailableCandidate = {
                        username: targetUsername,
                        timestamp: Date.now(),
                        claimed: false,
                    };
                    this.availableList.unshift(candidate);
                    this.foundListeners.forEach(l => l(candidate));

                    if (this.config.soundAlerts) {
                        playSuccessChime();
                    }

                    this.addLog(targetUsername, "available", `🎉 BOŞTA BULUNDU! (@${targetUsername})`);

                    Toasts.show({
                        id: Toasts.genId(),
                        message: `🎯 BOŞTA KULLANICI ADI BULUNDU: @${targetUsername}`,
                        type: Toasts.Type.SUCCESS,
                    });

                    sendDesktopNotification(
                        `🎯 Boşta Kullanıcı Adı: @${targetUsername}`,
                        "Hyper Username Sniper boşta nick yakaladı! Discord'u açın."
                    );

                    // Execute chosen claim action
                    await this.handleAvailableDiscovery(candidate);
                } else if (result.status === "taken") {
                    this.stats.totalChecked++;
                    this.checksInLastMinute++;
                    this.addLog(targetUsername, "taken", `Dolu`);
                    this.emitStats();
                } else if (result.status === "rate_limited") {
                    this.stats.rateLimitsHit++;
                    this.emitStats();
                    const waitSec = result.retryAfter || this.config.cooldownWaitSeconds || 60;
                    this.addLog(
                        targetUsername,
                        "rate_limited",
                        `⚠️ Discord Rate-Limit! (${waitSec}s bekleniyor...)`
                    );

                    if (this.config.autoRestartOnCooldown) {
                        await this.sleep(waitSec * 1000);
                        this.addLog("-", "info", "⏱️ Soğuma süresi tamamlandı, taramaya devam ediliyor.");
                    } else {
                        this.stop();
                        break;
                    }
                } else {
                    this.addLog(targetUsername, "error", result.error || "Bilinmeyen hata");
                }
            } catch (err: any) {
                this.addLog(targetUsername, "error", err?.message || "İstek hatası");
            }

            // Adaptive delay with slight random jitter
            const jitter = Math.floor(Math.random() * 200) - 100;
            const actualDelay = Math.max(1200, this.config.delayMs + jitter);
            await this.sleep(actualDelay);
        }

        if (this.currentIndex >= this.currentCandidates.length && this.isRunning) {
            this.addLog("-", "info", "✅ Listedeki tüm kullanıcı adları kontrol edildi.");
            this.stop();
        }
    }

    /**
     * Checks availability of a username via Discord's real pomelo-attempt REST endpoint
     */
    public async checkUsername(username: string): Promise<{
        status: "available" | "taken" | "rate_limited" | "error";
        retryAfter?: number;
        error?: string;
    }> {
        try {
            const res = await RestAPI.post({
                url: "/users/@me/pomelo-attempt",
                body: { username },
            });

            if (res && res.body) {
                if (res.body.taken === false) {
                    return { status: "available" };
                }
                return { status: "taken" };
            }

            return { status: "taken" };
        } catch (err: any) {
            // Discord 429 Rate Limit
            if (err?.status === 429 || err?.body?.retry_after !== undefined) {
                const retryAfter = Math.ceil(err?.body?.retry_after ?? 60);
                return { status: "rate_limited", retryAfter };
            }

            // 400 Bad Request or taken
            if (err?.status === 400) {
                return { status: "taken" };
            }

            return { status: "error", error: err?.message || `HTTP ${err?.status}` };
        }
    }

    /**
     * Test a single username immediately (Manual Instant Check)
     */
    public async testSingleUsername(username: string): Promise<{ status: "available" | "taken" | "rate_limited" | "error"; message: string; }> {
        const clean = username.trim().toLowerCase();
        if (!clean) return { status: "error", message: "Geçerli bir kullanıcı adı girin" };

        this.addLog(clean, "info", `🔍 Tekli Canlı Test: @${clean} Discord sunucularında sorgulanıyor...`);
        const result = await this.checkUsername(clean);

        if (result.status === "available") {
            this.addLog(clean, "available", `🎉 CANLI TEST SONUCU: @${clean} ŞU ANDA BOŞTA!`);
            playSuccessChime();
            return { status: "available", message: `@${clean} boşta! Alabilirsiniz.` };
        } else if (result.status === "taken") {
            this.addLog(clean, "taken", `Canlı Test Sonucu: @${clean} Discord'da dolu (alınmış).`);
            return { status: "taken", message: `@${clean} şu anda dolu.` };
        } else if (result.status === "rate_limited") {
            this.addLog(clean, "rate_limited", `Rate-Limit: ${result.retryAfter} saniye bekleyin.`);
            return { status: "rate_limited", message: `Discord rate-limit uyguladı (${result.retryAfter}s bekleyin).` };
        } else {
            this.addLog(clean, "error", `Hata: ${result.error}`);
            return { status: "error", message: result.error || "Hata oluştu" };
        }
    }

    /**
     * Handles claim actions when an available username is discovered
     */
    private async handleAvailableDiscovery(candidate: AvailableCandidate) {
        if (this.config.claimAction === "auto_claim") {
            // Instant Auto-Claim
            const claimed = await this.claimUsername(candidate.username, this.config.accountPassword);
            candidate.claimed = claimed;

            sendWebhookAlert(this.config.webhookUrl, {
                username: candidate.username,
                claimed,
                tier: this.config.mode.startsWith("3l") ? "vip" : "supporter",
                mode: this.config.mode,
                timestamp: Date.now(),
            });
        } else if (this.config.claimAction === "prompt_modal") {
            if (this.config.soundAlerts) {
                playAlarmBuzzer();
            }

            // Trigger visual modal popup confirmation
            if (this.promptModalCallback) {
                this.promptModalCallback(candidate, async () => {
                    const claimed = await this.claimUsername(candidate.username, this.config.accountPassword);
                    candidate.claimed = claimed;
                    return claimed;
                });
            }

            sendWebhookAlert(this.config.webhookUrl, {
                username: candidate.username,
                claimed: false,
                tier: this.config.mode.startsWith("3l") ? "vip" : "supporter",
                mode: this.config.mode,
                timestamp: Date.now(),
            });
        } else {
            // Notify Only
            sendWebhookAlert(this.config.webhookUrl, {
                username: candidate.username,
                claimed: false,
                tier: this.config.mode.startsWith("3l") ? "vip" : "supporter",
                mode: this.config.mode,
                timestamp: Date.now(),
            });
        }
    }

    /**
     * Claims the target username for current user account via PATCH /users/@me
     */
    public async claimUsername(username: string, password?: string): Promise<boolean> {
        try {
            this.addLog(username, "info", `⚡ @${username} hesaba alınıyor (Claim işlemi başlatıldı)...`);

            const body: any = {
                username,
            };
            if (password) {
                body.password = password;
            }

            const res = await RestAPI.patch({
                url: "/users/@me",
                body,
            });

            if (res && res.body && (res.body.username === username || res.ok)) {
                this.stats.claimedCount++;
                this.addLog(username, "claimed", `👑 BAŞARILI! @${username} HESABINIZA GEÇİRİLDİ!`);

                // Dispatch to Discord Flux Store so UI updates immediately everywhere
                try {
                    FluxDispatcher.dispatch({
                        type: "CURRENT_USER_UPDATE",
                        user: res.body,
                    });
                } catch {}

                Toasts.show({
                    id: Toasts.genId(),
                    message: `🎉 Tebrikler! @${username} kullanıcı adı hesabınıza tanımlandı!`,
                    type: Toasts.Type.SUCCESS,
                });

                sendDesktopNotification(
                    `👑 Kullanıcı Adı Alındı: @${username}`,
                    "Tebrikler! Kullanıcı adınız başarıyla değiştirildi."
                );

                this.emitStats();
                return true;
            }

            this.addLog(username, "error", `Claim başarısız oldu (Şifre gerekebilir veya başkası aldı)`);
            return false;
        } catch (err: any) {
            this.addLog(username, "error", `Claim hatası: ${err?.body?.message || err?.message || "Bilinmeyen hata"}`);
            return false;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(res => setTimeout(res, ms));
    }
}

export const sniperEngine = new SniperEngine();

