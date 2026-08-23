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

// Well-known, purely cosmetic browser/media-element noise that isn't a real
// bug and can't meaningfully be "fixed" in application code - confirmed live
// to be ~50% of all crash reports (ResizeObserver alone was ~30%), drowning
// out the real, actionable ones. Filtered at the source rather than after
// the fact so the crash list stays a useful signal.
const BENIGN_NOISE_PATTERNS = [
    /^ResizeObserver loop completed with undelivered notifications\.?$/,
    /^The play\(\) request was interrupted by/,
];

function isBenignNoise(message: string): boolean {
    return BENIGN_NOISE_PATTERNS.some(pattern => pattern.test(message)) || isDiscordApiResponseNoise(message);
}

// Discord's own request layer routinely logs already-handled, expected API/network
// conditions via console.error (rate limits, failed REST calls, raw fetch Response
// dumps) - our console.error hook (below) picks up the real Error objects wrapping
// these and reports them as "crashes", even though nothing actually broke. Confirmed
// live: this was ~45% of all 500 stored crash reports as of 2026-08-23, all with
// stacks pointing into discord.com's own bundle, none into ours - drowning out the
// small number of reports that are real, actionable bugs. Detected by shape (not by
// message text, since these are Turkish/localized and vary per-request) rather than
// by pattern-matching specific strings.
function isDiscordApiResponseNoise(message: string): boolean {
    if (!message.startsWith("{")) return false;

    let parsed: unknown;
    try {
        parsed = JSON.parse(message);
    } catch {
        // The message may get truncated (see reportCrash's message.slice(0, 300))
        // before this shape check ever sees it again on a re-report - fall back to
        // a prefix check for the biggest, highest-volume offender (a raw fetch/XHR
        // Response dump) so a cut-off object still gets caught.
        return /^\{("hasErr":\w+,)?"ok":false,"headers":/.test(message);
    }
    if (typeof parsed !== "object" || parsed === null) return false;

    const obj = parsed as Record<string, unknown>;
    // Discord's own rate-limit response shape.
    if ("retry_after" in obj && "global" in obj) return true;
    // Discord's own structured REST API error response shape.
    if ("code" in obj && "message" in obj && ("status" in obj || "fields" in obj)) return true;
    // A serialized fetch/XHR Response-like object from Discord's own request layer.
    if ("ok" in obj && ("headers" in obj || "hasErr" in obj)) return true;

    return false;
}

function reportCrash(message: string, stack: string) {
    if (!settings.store.enabled) return;
    if (isBenignNoise(message)) return;
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

// A rejection/error reason that isn't a real Error instance (a plain object,
// e.g. a Flux-style {type, ...} payload someone threw/rejected with) used to
// turn into the useless literal string "[object Object]" via String(reason) -
// confirmed live as ~11% of all crash reports, carrying zero diagnostic value.
// JSON.stringify-ing it instead keeps whatever shape the object actually had.
function stringifyReason(reason: unknown): string {
    if (reason instanceof Error) return reason.message;
    if (typeof reason === "object" && reason !== null) {
        try {
            const json = JSON.stringify(reason);
            if (json && json !== "{}") return json;
        } catch {
            // circular or otherwise unserializable - fall through
        }
    }
    return String(reason);
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
    const message = stringifyReason(reason);
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
