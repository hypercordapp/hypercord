/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { sniperEngine } from "@plugins/usernameSniper/sniperEngine";
import { AvailableCandidate, ClaimAction, SniperConfig, SniperLogEntry, SniperMode, SniperStats } from "@plugins/usernameSniper/types";
import { resolveUserTier } from "@plugins/usernameSniper/utils/tierManager";
import { copyWithToast } from "@utils/discord";
import { useEffect, UserStore,useState } from "@webpack/common";


const MODES: Array<{
    id: SniperMode;
    name: string;
    desc: string;
    requiredTier: "supporter" | "vip";
}> = [
    {
        id: "4l_letters",
        name: "4-Letter Sadece Harfler",
        desc: "aaaa - zzzz arası tüm 4 harfli kombinasyonlar",
        requiredTier: "supporter",
    },
    {
        id: "4l_alphanumeric",
        name: "4-Letter Harf + Rakam",
        desc: "a-z ve 0-9 karışık 4 haneli kombinasyonlar",
        requiredTier: "supporter",
    },
    {
        id: "4l_repeating",
        name: "4-Letter Nadir Desenler",
        desc: "aaaa, abab, aabb, abba gibi estetik desenler",
        requiredTier: "supporter",
    },
    {
        id: "3l_letters",
        name: "3-Letter Sadece Harfler",
        desc: "aaa - zzz arası tüm süper nadir 3 harfli kombinasyonlar",
        requiredTier: "vip",
    },
    {
        id: "3l_alphanumeric",
        name: "3-Letter Harf + Rakam",
        desc: "a-z ve 0-9 karışık nadir 3 haneli kombinasyonlar",
        requiredTier: "vip",
    },
    {
        id: "3l_repeating",
        name: "3-Letter Nadir & Tekrarlayan",
        desc: "777, 101, aba, aaa gibi ultra nadir desenler",
        requiredTier: "vip",
    },
    {
        id: "custom_wordlist",
        name: "Özel İsim Listesi (Wordlist)",
        desc: "Kendi belirlediğiniz hedef kullanıcı adı listesi",
        requiredTier: "vip",
    },
];

function SniperPanelContent() {
    const currentUser = UserStore.getCurrentUser();

    const [stats, setStats] = useState<SniperStats>(sniperEngine.getStats());
    const [logs, setLogs] = useState<SniperLogEntry[]>(sniperEngine.getLogs());
    const [config, setConfig] = useState<SniperConfig>(sniperEngine.getConfig());
    const [availableList, setAvailableList] = useState<AvailableCandidate[]>(sniperEngine.getAvailableList());
    const [activeTab, setActiveTab] = useState<"scanner" | "console" | "single_test" | "settings">("scanner");

    // Dynamic Server Role Resolution from Discord ID
    const [authInfo, setAuthInfo] = useState(resolveUserTier());
    const { tier } = authInfo;

    const [testInput, setTestInput] = useState("");
    const [testResult, setTestResult] = useState<{ status: string; message: string; } | null>(null);
    const [testLoading, setTestLoading] = useState(false);

    useEffect(() => {
        // Refresh tier on mount
        const currentAuth = resolveUserTier();
        setAuthInfo(currentAuth);

        const unsubStats = sniperEngine.subscribeStats(newStats => setStats(newStats));
        const unsubLogs = sniperEngine.subscribeLogs(newLogs => setLogs(newLogs));
        const unsubFound = sniperEngine.subscribeFound(() => {
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

    const isModeAllowedForTier = (modeTier: "supporter" | "vip"): boolean => {
        if (tier === "vip") return true;
        if (tier === "supporter") return modeTier === "supporter";
        return false;
    };

    const handleSelectMode = (m: typeof MODES[0]) => {
        if (!isModeAllowedForTier(m.requiredTier)) {
            return;
        }
        handleConfigChange("mode", m.id);
    };

    const handleToggleStart = () => {
        const currentModeObj = MODES.find(m => m.id === config.mode);
        if (currentModeObj && !isModeAllowedForTier(currentModeObj.requiredTier)) {
            sniperEngine.addLog("-", "error", `Bu modu kullanabilmek için ${currentModeObj.requiredTier.toUpperCase()} paketi gereklidir.`);
            return;
        }

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
        const res = await sniperEngine.testSingleUsername(testInput);
        setTestResult(res);
        setTestLoading(false);
    };

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
    };

    const selectedModeObj = MODES.find(m => m.id === config.mode) || MODES[0];
    const isCurrentModeLocked = !isModeAllowedForTier(selectedModeObj.requiredTier);

    return (
        <div className="hyper-sniper-container">
            {/* Hero Header */}
            <div className="hyper-sniper-hero">
                <div className="hyper-sniper-user-info">
                    {currentUser && (
                        <img
                            className="hyper-sniper-avatar"
                            src={currentUser.getAvatarURL?.(undefined, 80) || "https://cdn.discordapp.com/embed/avatars/0.png"}
                            alt="User"
                        />
                    )}
                    <div>
                        <div className="hyper-sniper-heading-title">Hyper Username Sniper</div>
                        <div className="hyper-sniper-heading-desc">
                            Discord 3L & 4L Nadir Kullanıcı Adı Avcısı ve Otomatik Yakalama Sistemi
                        </div>
                    </div>
                </div>

                <div className="hyper-sniper-tier-controls">
                    <div className={`hyper-sniper-tier-pill ${tier}`}>
                        {tier === "vip" && "👑 VIP AKTİF (3L + 4L AÇIK)"}
                        {tier === "supporter" && "🌟 DESTEKÇİ AKTİF (4L AÇIK)"}
                        {tier === "free" && "🔒 ÜCRETSİZ HESAP (KİLİTLİ)"}
                    </div>
                    {authInfo.roleName ? (
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            Yetki: {authInfo.roleName}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Segmented Navigation Tabs */}
            <div className="hyper-sniper-tabs">
                <button
                    className={`hyper-sniper-tab-btn ${activeTab === "scanner" ? "active" : ""}`}
                    onClick={() => setActiveTab("scanner")}
                >
                    ⚡ Avcı Paneli
                </button>
                <button
                    className={`hyper-sniper-tab-btn ${activeTab === "console" ? "active" : ""}`}
                    onClick={() => setActiveTab("console")}
                >
                    📟 Canlı Konsol ({logs.length})
                </button>
                <button
                    className={`hyper-sniper-tab-btn ${activeTab === "single_test" ? "active" : ""}`}
                    onClick={() => setActiveTab("single_test")}
                >
                    🔍 Tekli Canlı Test
                </button>
                <button
                    className={`hyper-sniper-tab-btn ${activeTab === "settings" ? "active" : ""}`}
                    onClick={() => setActiveTab("settings")}
                >
                    ⚙️ Bildirim & Güvenlik
                </button>
            </div>

            {/* Metrics Row */}
            <div className="hyper-sniper-metrics-grid">
                <div className="hyper-sniper-metric-card">
                    <span className="hyper-sniper-metric-title">Toplam Taranan</span>
                    <span className="hyper-sniper-metric-value cyan">
                        {stats.totalChecked.toLocaleString()}
                    </span>
                </div>

                <div className="hyper-sniper-metric-card">
                    <span className="hyper-sniper-metric-title">Boşta Bulunan</span>
                    <span className="hyper-sniper-metric-value green">
                        {stats.availableFound}
                    </span>
                </div>

                <div className="hyper-sniper-metric-card">
                    <span className="hyper-sniper-metric-title">Hesaba Alınan</span>
                    <span className="hyper-sniper-metric-value gold">
                        {stats.claimedCount}
                    </span>
                </div>

                <div className="hyper-sniper-metric-card">
                    <span className="hyper-sniper-metric-title">Tarama Hızı</span>
                    <span className="hyper-sniper-metric-value">
                        {stats.checksPerMinute}/dk
                    </span>
                </div>

                <div className="hyper-sniper-metric-card">
                    <span className="hyper-sniper-metric-title">Rate-Limit</span>
                    <span className="hyper-sniper-metric-value" style={{ color: stats.rateLimitsHit > 0 ? "#f59e0b" : "#64748b" }}>
                        {stats.rateLimitsHit}
                    </span>
                </div>
            </div>

            {/* Tab 1: Scanner Panel */}
            {activeTab === "scanner" && (
                <div className="hyper-sniper-card">
                    <div className="hyper-sniper-card-title">
                        <span>🎯</span> Tarama Modu Seçimi
                    </div>

                    <div className="hyper-sniper-options-grid">
                        {MODES.map(m => {
                            const allowed = isModeAllowedForTier(m.requiredTier);
                            const isSelected = config.mode === m.id;

                            return (
                                <div
                                    key={m.id}
                                    className={`hyper-sniper-mode-option ${isSelected ? "selected" : ""} ${!allowed ? "disabled" : ""}`}
                                    onClick={() => handleSelectMode(m)}
                                >
                                    <div>
                                        <div className="hyper-sniper-mode-name">{m.name}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{m.desc}</div>
                                    </div>

                                    <div>
                                        {allowed ? (
                                            <span className={`hyper-sniper-mode-badge ${m.requiredTier}`}>
                                                {m.requiredTier === "vip" ? "VIP" : "100 TL"}
                                            </span>
                                        ) : (
                                            <span className="hyper-sniper-mode-badge locked">
                                                🔒 {m.requiredTier.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {isCurrentModeLocked && (
                        <div className="hyper-sniper-locked-notice">
                            <div className="hyper-sniper-locked-text">
                                ⚠️ Seçili tarama modu <strong>{selectedModeObj.requiredTier.toUpperCase()}</strong> paketi gerektirir.
                            </div>
                            <a
                                href="https://www.shopier.com/hypercord"
                                target="_blank"
                                rel="noreferrer"
                                className="hyper-sniper-shopier-link"
                            >
                                Shopier'den Yükselt
                            </a>
                        </div>
                    )}

                    {config.mode === "custom_wordlist" && (
                        <div>
                            <div className="hyper-sniper-label">Özel Hedef Kelimeler (Virgül veya Alt Alta)</div>
                            <textarea
                                className="hyper-sniper-input-textarea"
                                placeholder="hyper, shadow, blade, viper, zero, alpha..."
                                value={config.customWordlist}
                                onChange={e => handleConfigChange("customWordlist", e.target.value)}
                                disabled={stats.isRunning}
                            />
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6 }}>
                        <div style={{ flex: 1 }}>
                            <div className="hyper-sniper-label">Boşta Nick Bulunduğunda Yapılacak İşlem</div>
                            <select
                                className="hyper-sniper-input-select"
                                value={config.claimAction}
                                onChange={e => handleConfigChange("claimAction", e.target.value as ClaimAction)}
                            >
                                <option value="prompt_modal">🔔 Ekranda Acil Onay Penceresi Aç (Önerilen)</option>
                                <option value="auto_claim">🚀 Milisaniyelik Otomatik Al (Instant Claim)</option>
                                <option value="notify_only">📢 Sadece Webhook & Sesli Bildirim Gönder</option>
                            </select>
                        </div>

                        <div style={{ flex: 1, display: "flex", gap: 8, marginTop: 18 }}>
                            <button
                                className={stats.isRunning ? "hyper-sniper-btn-danger" : "hyper-sniper-btn-primary"}
                                style={{ flex: 2 }}
                                onClick={handleToggleStart}
                                disabled={isCurrentModeLocked && !stats.isRunning}
                            >
                                {stats.isRunning ? "⏹️ Taramayı Durdur" : "🚀 Taramayı Başlat"}
                            </button>
                            <button
                                className="hyper-sniper-btn-secondary"
                                style={{ flex: 1 }}
                                onClick={() => sniperEngine.resetStats()}
                                disabled={stats.isRunning}
                            >
                                🔄 Sıfırla
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: Live Console Log */}
            {activeTab === "console" && (
                <div className="hyper-sniper-card">
                    <div className="hyper-sniper-console">
                        <div className="hyper-sniper-console-header">
                            <span>CANLI İSTEK VE KONSOL RADARI</span>
                            <span>
                                {stats.isRunning ? (
                                    <span style={{ color: "#23a55a" }}>● TARANIYOR: @{stats.currentUsername || "..."}</span>
                                ) : (
                                    <span>○ BEKLEMEDE</span>
                                )}
                            </span>
                        </div>

                        {logs.length === 0 ? (
                            <div style={{ color: "#64748b", fontStyle: "italic", textAlign: "center", margin: "auto" }}>
                                Canlı istek ve tarama logları burada görüntülenecektir...
                            </div>
                        ) : (
                            logs.map(log => (
                                <div className="hyper-sniper-console-line" key={log.id}>
                                    <span style={{ color: "#475569", fontSize: 11 }}>[{formatTime(log.timestamp)}]</span>
                                    <span className={`hyper-sniper-tag ${log.status}`}>{log.status}</span>
                                    <span style={{ color: "var(--text-normal)" }}>
                                        {log.username !== "-" ? `@${log.username} ` : ""}
                                        {log.message || ""}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Tab 3: Single Live Test */}
            {activeTab === "single_test" && (
                <div className="hyper-sniper-card">
                    <div className="hyper-sniper-card-title">
                        <span>🔍</span> Canlı Tekli Kullanıcı Adı Testi (Discord API Doğrulama)
                    </div>

                    <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                        Sistemin Discord REST API'sini gerçek zamanlı sorguladığını doğrulamak için dilediğiniz bir kullanıcı adını yazıp sorgulayın:
                    </p>

                    <div style={{ display: "flex", gap: 10, maxWidth: 500 }}>
                        <input
                            type="text"
                            className="hyper-sniper-input-text"
                            placeholder="Örn: ahmet, 9x9, shadow, test_user..."
                            value={testInput}
                            onChange={e => setTestInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSingleTest()}
                        />
                        <button
                            className="hyper-sniper-btn-primary"
                            onClick={handleSingleTest}
                            disabled={testLoading}
                            style={{ flexShrink: 0 }}
                        >
                            {testLoading ? "Sorgulanıyor..." : "Canlı Sorgula"}
                        </button>
                    </div>

                    {testResult && (
                        <div
                            style={{
                                padding: "12px 16px",
                                borderRadius: 8,
                                background: testResult.status === "available" ? "rgba(35, 165, 90, 0.15)" : "rgba(255, 255, 255, 0.05)",
                                border: testResult.status === "available" ? "1px solid #23a55a" : "1px solid rgba(255, 255, 255, 0.1)",
                                color: testResult.status === "available" ? "#23a55a" : "var(--text-normal)",
                                fontSize: 14,
                                fontWeight: 600,
                            }}
                        >
                            {testResult.message}
                        </div>
                    )}
                </div>
            )}

            {/* Tab 4: Settings & Webhook */}
            {activeTab === "settings" && (
                <div className="hyper-sniper-card">
                    <div className="hyper-sniper-card-title">
                        <span>⚙️</span> Hız, Güvenlik ve Bildirim Ayarları
                    </div>

                    <div>
                        <div className="hyper-sniper-label">
                            İstek Gecikmesi: {config.delayMs}ms (~{Math.round(60000 / config.delayMs)} istek/dk)
                        </div>
                        <input
                            type="range"
                            min={1200}
                            max={5000}
                            step={100}
                            style={{ width: "100%", accentColor: "var(--brand-experiment, #5865f2)" }}
                            value={config.delayMs}
                            onChange={e => handleConfigChange("delayMs", Number(e.target.value))}
                            disabled={stats.isRunning}
                        />
                    </div>

                    <div>
                        <div className="hyper-sniper-label">Discord Webhook URL (Telefon / Özel Kanal Bildirimi)</div>
                        <input
                            type="text"
                            className="hyper-sniper-input-text"
                            placeholder="https://discord.com/api/webhooks/..."
                            value={config.webhookUrl}
                            onChange={e => handleConfigChange("webhookUrl", e.target.value)}
                        />
                    </div>

                    <div>
                        <div className="hyper-sniper-label">Discord Hesap Şifresi (Otomatik Claim İçin Gerekirse)</div>
                        <input
                            type="password"
                            className="hyper-sniper-input-text"
                            placeholder="Otomatik talep için hesap şifreniz (opsiyonel)..."
                            value={config.accountPassword || ""}
                            onChange={e => handleConfigChange("accountPassword", e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* Available Discovered Usernames List */}
            {availableList.length > 0 && (
                <div className="hyper-sniper-card" style={{ borderColor: "#23a55a" }}>
                    <div style={{ fontWeight: 800, color: "#23a55a", fontSize: 14 }}>
                        🎉 BOŞTA YAKALANAN KULLANICI ADLARI ({availableList.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {availableList.map((item, idx) => (
                            <div
                                key={idx}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    background: "var(--background-tertiary, #111214)",
                                    padding: "10px 14px",
                                    borderRadius: 8,
                                }}
                            >
                                <span style={{ fontSize: 16, fontWeight: 800, color: "#23a55a" }}>
                                    @{item.username}
                                </span>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                        className="hyper-sniper-btn-secondary"
                                        style={{ padding: "6px 12px", fontSize: 12 }}
                                        onClick={() => copyWithToast(item.username)}
                                    >
                                        Kopyala
                                    </button>
                                    {!item.claimed ? (
                                        <button
                                            className="hyper-sniper-btn-primary"
                                            style={{ padding: "6px 12px", fontSize: 12 }}
                                            onClick={() => handleManualClaim(item)}
                                        >
                                            ⚡ Hesaba Al
                                        </button>
                                    ) : (
                                        <span style={{ color: "#23a55a", fontWeight: 700, fontSize: 12, padding: "6px 8px" }}>
                                            ✓ Hesaba Alındı
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SniperPanel() {
    return (
        <ErrorBoundary>
            <SniperPanelContent />
        </ErrorBoundary>
    );
}

