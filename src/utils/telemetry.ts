/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { gitHashShort } from "@shared/vencordUserAgent";

import { PluginMeta } from "~plugins";

const CRASH_URL = "https://api.hypercord.pro/telemetry/crash";

// Separate rate limit from HyperCordTelemetry's own generic window.onerror
// reporter (src/plugins/_core/hyperCordTelemetry) - this one exists for
// errors that framework code can already attribute to a specific plugin at
// the point they're caught (patch application, start/stop, event handlers),
// which is far more reliable than trying to reverse-engineer a plugin name
// out of a minified stack trace after the fact.
const MAX_REPORTS_PER_SESSION = 10;
const reportedKeys = new Set<string>();
let reportCount = 0;

function isTelemetryEnabled() {
    // Read by settings key directly rather than importing the plugin module -
    // this file is used from core webpack/plugin-manager code that loads
    // before the plugin registry does, so importing a plugin from here would
    // invert the usual dependency direction.
    return (Settings.plugins as Record<string, { enabled?: boolean; }>).HyperCordTelemetry?.enabled !== false;
}

export function reportPluginError(plugin: string, message: string, stack?: string) {
    if (!isTelemetryEnabled()) return;
    // Same rule HyperCordTelemetry's own usage ping already follows: never
    // report anything identifying a third-party userplugin, only HyperCord's
    // own catalog - a userplugin's name isn't HyperCord's to report.
    if (PluginMeta[plugin]?.userPlugin) return;
    if (reportCount >= MAX_REPORTS_PER_SESSION) return;

    const key = `${plugin}:${message}`;
    if (reportedKeys.has(key)) return;
    reportedKeys.add(key);
    reportCount++;

    fetch(CRASH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: message.slice(0, 300),
            stack: (stack ?? "").slice(0, 2000),
            version: gitHashShort,
            plugin
        })
    }).catch(() => { });
}
