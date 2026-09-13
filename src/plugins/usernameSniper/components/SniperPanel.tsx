/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyWithToast } from "@utils/discord";
import { useEffect, useState } from "@webpack/common";

import { sniperEngine } from "../sniperEngine";
import { AvailableCandidate, ClaimAction, SniperConfig, SniperLogEntry, SniperMode, SniperStats, SniperTier } from "../types";
import { StatsGrid } from "./StatsCard";
import { TerminalLog } from "./TerminalLog";

export default function SniperPanel() {
    const [stats, setStats] = useState<SniperStats>(sniperEngine.getStats());
    const [logs, setLogs] = useState<SniperLogEntry[]>(sniperEngine.getLogs());
    const [config, setConfig] = useState<SniperConfig>(sniperEngine.getConfig());
    const [availableList, setAvailableList] = useState<AvailableCandidate[]>(sniperEngine.getAvailableList());
    const [testInput, setTestInput] = useState("");
    const [testLoading, setTestLoading] = useState(false);

    // Tier management - VIP active
    const [tier, setTier] = useState<SniperTier>("vip");

    useEffect(() => {
        const unsubStats = sniperEngine.subscribeStats(newStats => setStats(newStats));
        const unsubLogs = sniperEngine.subscribeLogs(newLogs => setLogs(newLogs));
        const unsubFound = sniperEngine.subscribeFound(candidate => {
            setAvailableList(sniperEngine.getAvailableList());
        });

        return () => {
            unsubStats();
            unsubLogs();
            unsubFound();
        };
    }, []);

    const handleConfigChange = <K extends keyof SniperConfig>(key: K, value: SniperConfig[K]) => {
        const updated = { ...config, [key]: value };
        setConfig(updated);
        sniperEngine.updateConfig(updated);
    };

    const handleToggleStart = () => {
        if (stats.isRunning) {
            sniperEngine.stop();
        } else {
            sniperEngine.start();
        }
    };

    const handleManualClaim = async (candidate: AvailableCandidate) => {
        const success = await sniperEngine.claimUsername(candidate.username, config.accountPassword);
        if (success) {
            candidate.claimed = true;
            setAvailableList([...availableList]);
        }
    };

    const handleSingleTest = async () => {
        if (!testInput.trim()) return;
        setTestLoading(true);
        await sniperEngine.testSingleUsername(testInput);
        setTestLoading(false);
    };

    return (
        <div className="hypercord-sniper-root">
            {/* Header */}
            <div className="hypercord-sniper-header">
                <div className="hypercord-sniper-title-group">
                    <div className="hypercord-sniper-title-icon-wrapper">
                        <span className="hypercord-sniper-title-icon">⚡</span>
                    </div>
                    <div>
                        <h1 className="hypercord-sniper-title">Hyper Username Sniper</h1>
                        <div className="hypercord-sniper-subtitle">
                            Discord 3L & 4L Nadir Kullanıcı Adı Avcısı ve Otomatik Yakalama Sistemi
                        </div>
                    </div>
                </div>

                <div className="hypercord-sniper-tier-badge vip">
                    👑 VIP ULTRA AKTİF (250 TL PAKET)
                </div>
            </div>

            {/* Live Metrics Grid */}
            <StatsGrid stats={stats} />

            {/* Live Terminal Log */}
            <TerminalLog
                logs={logs}
                currentUsername={stats.currentUsername}
                isRunning={stats.isRunning}
            />

            {/* Action Buttons */}
            <div className="hypercord-sniper-actions-row">
                <button
                    className={`hypercord-sniper-btn ${stats.isRunning ? "stop" : "start"}`}
                    onClick={handleToggleStart}
                >
                    {stats.isRunning ? "⏹️ TARAMAYI DURDUR" : "🚀 TARAMAYI BAŞLAT"}
                </button>

                <button
                    className="hypercord-sniper-btn secondary"
                    onClick={() => sniperEngine.resetStats()}
                    disabled={stats.isRunning}
                >
                    🔄 İstatistikleri Sıfırla
                </button>
            </div>

            {/* Found Usernames List */}
            {availableList.length > 0 && (
                <div className="hypercord-sniper-found-list">
                    <div style={{ fontWeight: 800, color: "#10B981", fontSize: 14 }}>
                        🎉 BOŞTA TESPİT EDİLEN KULLANICI ADLARI ({availableList.length})
                    </div>
                    {availableList.map((item, idx) => (
                        <div className="hypercord-sniper-found-item" key={idx}>
                            <span className="hypercord-sniper-found-name">@{item.username}</span>
                            <div className="hypercord-sniper-found-actions">
                                <button
                                    className="hypercord-sniper-quick-claim-btn"
                                    onClick={() => copyWithToast(item.username)}
                                    style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}
                                >
                                    Kopyala
                                </button>
                                {!item.claimed ? (
                                    <button
                                        className="hypercord-sniper-quick-claim-btn"
                                        onClick={() => handleManualClaim(item)}
                                    >
                                        ⚡ Hesaba Al (Claim)
                                    </button>
                                ) : (
                                    <span style={{ color: "#10B981", fontWeight: 700, fontSize: 12, padding: "6px 8px" }}>
                                        ✓ Hesaba Alındı
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Configuration Controls */}
            <div className="hypercord-sniper-controls-grid">
                {/* Left Column: Mode & Claim Action */}
                <div className="hypercord-sniper-control-card">
                    <div className="hypercord-sniper-control-title">
                        <span>🎯</span> Tarama Modu ve Hedef Listesi
                    </div>

                    <div>
                        <div className="hypercord-sniper-field-label">Kombinasyon Tipi</div>
                        <select
                            className="hypercord-sniper-select"
                            value={config.mode}
                            onChange={e => handleConfigChange("mode", e.target.value as SniperMode)}
                            disabled={stats.isRunning}
                        >
                            <option value="3l_letters">👑 3-Letter Sadece Harfler (aaa - zzz) [VIP 250 TL]</option>
                            <option value="3l_alphanumeric">👑 3-Letter Harf + Rakam (a-z, 0-9) [VIP 250 TL]</option>
                            <option value="3l_repeating">👑 3-Letter Nadir Desenler (777, aba) [VIP 250 TL]</option>
                            <option value="4l_letters">🌟 4-Letter Sadece Harfler (aaaa - zzzz) [100 TL Destekçi]</option>
                            <option value="4l_alphanumeric">🌟 4-Letter Harf + Rakam (a-z, 0-9) [100 TL Destekçi]</option>
                            <option value="4l_repeating">🌟 4-Letter Nadir Desenler (abab, aabb) [100 TL Destekçi]</option>
                            <option value="custom_wordlist">👑 Özel İsim Listesi (Wordlist) [VIP 250 TL]</option>
                        </select>
                    </div>

                    {config.mode === "custom_wordlist" && (
                        <div>
                            <div className="hypercord-sniper-field-label">Özel Kelimeler (Virgül veya Satır Başı ile Ayrılmış)</div>
                            <textarea
                                className="hypercord-sniper-textarea"
                                placeholder="hyper, shadow, blade, valorant, viper, zero..."
                                value={config.customWordlist}
                                onChange={e => handleConfigChange("customWordlist", e.target.value)}
                                disabled={stats.isRunning}
                            />
                        </div>
                    )}

                    <div>
                        <div className="hypercord-sniper-field-label">Boşta Nick Bulunduğunda Yapılacak İşlem</div>
                        <select
                            className="hypercord-sniper-select"
                            value={config.claimAction}
                            onChange={e => handleConfigChange("claimAction", e.target.value as ClaimAction)}
                        >
                            <option value="prompt_modal">🔔 Ekranda Acil Onay Penceresi Aç (Önerilen)</option>
                            <option value="auto_claim">🚀 Milisaniyelik Otomatik Al (Instant Claim)</option>
                            <option value="notify_only">📢 Sadece Webhook & Ses ile Bildir</option>
                        </select>
                    </div>

                    {/* Live Single Test Box */}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12, marginTop: 4 }}>
                        <div className="hypercord-sniper-field-label">🔍 Canlı Tekli Nick Testi (Discord API Doğrulama)</div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <input
                                type="text"
                                className="hypercord-sniper-input"
                                placeholder="Test etmek istediğiniz nick..."
                                value={testInput}
                                onChange={e => setTestInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleSingleTest()}
                            />
                            <button
                                className="hypercord-sniper-quick-claim-btn"
                                onClick={handleSingleTest}
                                disabled={testLoading}
                                style={{ flexShrink: 0, padding: "0 16px" }}
                            >
                                {testLoading ? "..." : "Sorgula"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Speed & Alerts */}
                <div className="hypercord-sniper-control-card">
                    <div className="hypercord-sniper-control-title">
                        <span>⚙️</span> Hız, Güvenlik ve Bildirimler
                    </div>

                    <div>
                        <div className="hypercord-sniper-field-label">
                            İstek Gecikmesi: {config.delayMs}ms (~{Math.round(60000 / config.delayMs)} istek/dk)
                        </div>
                        <input
                            type="range"
                            min={1200}
                            max={5000}
                            step={100}
                            style={{ width: "100%", accentColor: "#8B5CF6" }}
                            value={config.delayMs}
                            onChange={e => handleConfigChange("delayMs", Number(e.target.value))}
                            disabled={stats.isRunning}
                        />
                    </div>

                    <div>
                        <div className="hypercord-sniper-field-label">Discord Webhook URL (Telefon/Özel Kanal Bildirimi)</div>
                        <input
                            type="text"
                            className="hypercord-sniper-input"
                            placeholder="https://discord.com/api/webhooks/..."
                            value={config.webhookUrl}
                            onChange={e => handleConfigChange("webhookUrl", e.target.value)}
                        />
                    </div>

                    <div>
                        <div className="hypercord-sniper-field-label">Discord Hesap Şifresi (Otomatik Claim İçin Opsiyonel)</div>
                        <input
                            type="password"
                            className="hypercord-sniper-input"
                            placeholder="Otomatik talep için gerekirse girin..."
                            value={config.accountPassword || ""}
                            onChange={e => handleConfigChange("accountPassword", e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
