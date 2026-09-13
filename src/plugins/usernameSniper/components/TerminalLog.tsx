/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useRef } from "@webpack/common";

import { SniperLogEntry } from "../types";

export function TerminalLog({ logs, currentUsername, isRunning }: {
    logs: SniperLogEntry[];
    currentUsername: string;
    isRunning: boolean;
}) {
    const terminalRef = useRef<HTMLDivElement>(null);

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
    };

    return (
        <div className="hypercord-sniper-terminal" ref={terminalRef}>
            <div className="hypercord-sniper-terminal-header">
                <span>HYPER SNIPER // CANLI İSTEK VE KONSOL RADARI</span>
                <span>
                    {isRunning ? (
                        <span style={{ color: "#10B981" }}>
                            <span className="hypercord-sniper-pulse-dot" />
                            TARANIYOR: @{currentUsername || "..."}
                        </span>
                    ) : (
                        <span style={{ color: "#64748b" }}>○ BEKLEMEDE</span>
                    )}
                </span>
            </div>

            {logs.length === 0 ? (
                <div style={{ color: "#555", fontStyle: "italic", marginTop: 20, textAlign: "center" }}>
                    Tarama başlatıldığında canlı istekler ve sonuçlar burada akacaktır...
                </div>
            ) : (
                logs.map(log => (
                    <div className="hypercord-sniper-log-line" key={log.id}>
                        <span className="hypercord-sniper-log-time">[{formatTime(log.timestamp)}]</span>
                        <span className={`hypercord-sniper-log-tag ${log.status}`}>
                            {log.status}
                        </span>
                        <span className="hypercord-sniper-log-text">
                            {log.username !== "-" ? `@${log.username} ` : ""}
                            {log.message || ""}
                        </span>
                    </div>
                ))
            )}
        </div>
    );
}
