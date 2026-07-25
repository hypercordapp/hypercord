/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { gitHashShort } from "@shared/vencordUserAgent";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, UserStore } from "@webpack/common";

const PING_URL = "https://api.hypercord.pro/telemetry/ping";
const CRASH_URL = "https://api.hypercord.pro/telemetry/crash";
const logger = new Logger("HyperCordTelemetry");

// Keeps a single crash storm (the same error firing in a loop) from spamming
// the backend - one report per distinct message per session is plenty to
// know it happened.
const MAX_CRASH_REPORTS_PER_SESSION = 10;
const reportedCrashMessages = new Set<string>();
let crashReportCount = 0;

export const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Let the HyperCord team see that you use HyperCord, and report crashes to help fix them (sends your user ID + current username once per session, and anonymous crash reports with no user ID attached - nothing else)",
        default: true
    }
});

function ping() {
    if (!settings.store.enabled) return;

    const user = UserStore.getCurrentUser();
    if (!user) return;

    fetch(PING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, username: user.username })
    }).catch(e => logger.error("Failed to report usage", e));
}

function reportCrash(message: string, stack: string) {
    if (!settings.store.enabled) return;
    if (crashReportCount >= MAX_CRASH_REPORTS_PER_SESSION) return;
    if (reportedCrashMessages.has(message)) return;

    reportedCrashMessages.add(message);
    crashReportCount++;

    fetch(CRASH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: message.slice(0, 300),
            stack: stack.slice(0, 2000),
            version: gitHashShort
        })
    }).catch(e => logger.error("Failed to report crash", e));
}

function onError(event: ErrorEvent) {
    const { error } = event;
    reportCrash(
        error?.message || event.message || "Unknown error",
        error?.stack || ""
    );
}

function onUnhandledRejection(event: PromiseRejectionEvent) {
    const { reason } = event;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? (reason.stack ?? "") : "";
    reportCrash(message || "Unhandled rejection", stack);
}

export default definePlugin({
    name: "HyperCordTelemetry",
    description: "Reports that you use HyperCord (user ID + current username, nothing more) and anonymous crash reports (no user ID attached) to HyperCord's own backend, so the team can see real usage numbers and fix crashes. Toggle off below to opt out.",
    authors: [Devs.HyperCordTeam],
    required: true,
    settings,

    start() {
        ping();
        FluxDispatcher.subscribe("CONNECTION_OPEN", ping);
        window.addEventListener("error", onError);
        window.addEventListener("unhandledrejection", onUnhandledRejection);
    },

    stop() {
        FluxDispatcher.unsubscribe("CONNECTION_OPEN", ping);
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onUnhandledRejection);
    }
});
