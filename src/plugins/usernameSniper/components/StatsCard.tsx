/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SniperStats } from "../types";

export function StatsGrid({ stats }: { stats: SniperStats; }) {
    return (
        <div className="hypercord-sniper-stats-grid">
            <div className="hypercord-sniper-stat-card">
                <span className="hypercord-sniper-stat-label">Toplam Taranan</span>
                <span className="hypercord-sniper-stat-value highlight-cyan">
                    {stats.totalChecked.toLocaleString()}
                </span>
            </div>

            <div className="hypercord-sniper-stat-card">
                <span className="hypercord-sniper-stat-label">Boşta Bulunan</span>
                <span className="hypercord-sniper-stat-value highlight-green">
                    {stats.availableFound}
                </span>
            </div>

            <div className="hypercord-sniper-stat-card">
                <span className="hypercord-sniper-stat-label">Hesaba Alınan</span>
                <span className="hypercord-sniper-stat-value highlight-gold">
                    {stats.claimedCount}
                </span>
            </div>

            <div className="hypercord-sniper-stat-card">
                <span className="hypercord-sniper-stat-label">Tarama Hızı</span>
                <span className="hypercord-sniper-stat-value highlight-violet">
                    {stats.checksPerMinute}/dk
                </span>
            </div>

            <div className="hypercord-sniper-stat-card">
                <span className="hypercord-sniper-stat-label">Rate-Limit</span>
                <span className="hypercord-sniper-stat-value" style={{ color: stats.rateLimitsHit > 0 ? "#F59E0B" : "#64748b" }}>
                    {stats.rateLimitsHit}
                </span>
            </div>
        </div>
    );
}

