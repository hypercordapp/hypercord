/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { gitHashShort } from "@shared/vencordUserAgent";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, UserStore } from "@webpack/common";

import plugins, { PluginMeta } from "~plugins";

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
        description: "Let the HyperCord team see that you use HyperCord, report crashes to help fix them, and share which official plugins you have enabled to power the real \"most used plugins\" list on hypercord.pro (sends your user ID + current username + the names of your enabled official HyperCord plugins once per session, and anonymous crash reports with no user ID attached - never plugin settings/values, never third-party userplugins, nothing else)",
        default: true
    },
});

// Official catalog plugins only, and only ones a user actually chose to turn
// on - never third-party userplugins (arbitrary names, not HyperCord's to
// report) and never required/API plugins (always-on for everyone, so "usage"
// of those is meaningless noise), same filter supportHelper's debug dump
// already uses for the same reason.
function getEnabledPluginNames(): string[] {
    const isApiPlugin = (name: string) => name.endsWith("API") || plugins[name].required;

    return Object.keys(plugins).filter(name =>
        !PluginMeta[name].userPlugin && !isApiPlugin(name) && isPluginEnabled(name)
    );
}

function ping() {
    if (!settings.store.enabled) return;

    const user = UserStore.getCurrentUser();
    if (!user) return;

    fetch(PING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, username: user.username, enabledPlugins: getEnabledPluginNames() })
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

// React's own error boundaries (componentDidCatch) swallow the error before
// it ever becomes a real uncaught exception - they never reach window.onerror
// or unhandledrejection, they only ever get printed via console.error. This
// was a real, confirmed blind spot: a genuine user-facing crash (a proxy
// invariant TypeError, caught by a Discord-internal boundary and recovered
// from) never showed up in crash telemetry at all, only in the raw devtools
// console a user happened to paste manually. Wrapping console.error to also
// catch real Error objects logged this way - not just plain warning strings -
// closes that gap without touching anything else console.error is used for.
let originalConsoleError: typeof console.error | undefined;

function patchConsoleError() {
    if (originalConsoleError) return;
    originalConsoleError = console.error.bind(console);

    console.error = (...args: unknown[]) => {
        originalConsoleError!(...args);
        try {
            const error = args.find((a): a is Error => a instanceof Error);
            if (error) reportCrash(error.message || "Unknown error", error.stack || "");
        } catch {
            // never let crash-reporting itself break logging
        }
    };
}

function unpatchConsoleError() {
    if (originalConsoleError) console.error = originalConsoleError;
    originalConsoleError = undefined;
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
        patchConsoleError();
    },

    stop() {
        FluxDispatcher.unsubscribe("CONNECTION_OPEN", ping);
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onUnhandledRejection);
        unpatchConsoleError();
    }
});
