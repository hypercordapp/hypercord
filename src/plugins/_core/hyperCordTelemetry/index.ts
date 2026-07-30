/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { showNotification } from "@api/Notifications";
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
const ANNOUNCEMENT_URL = "https://api.hypercord.pro/announcement";
const SEEN_ANNOUNCEMENT_KEY = "HyperCord_lastSeenAnnouncementId";
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
    showAnnouncements: {
        type: OptionType.BOOLEAN,
        description: "Occasionally show a HyperCord team notification (e.g. Discord server invites, major updates). This only ever receives a small public message, it never sends any of your data.",
        default: true
    }
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

interface AnnouncementResponse {
    id: string | null;
    title: string;
    body: string;
    url: string | null;
    enabled: boolean;
}

// Remote-controlled so the team can push a one-time notice (e.g. "join our
// Discord") without shipping a new devbuild. Each publish on the backend gets
// a fresh id - comparing against the last id we've shown (persisted in
// DataStore) is what makes this "once per announcement" instead of nagging
// on every launch.
async function checkAnnouncement() {
    if (!settings.store.showAnnouncements) return;

    try {
        const res = await fetch(ANNOUNCEMENT_URL);
        if (!res.ok) return;

        const announcement: AnnouncementResponse = await res.json();
        if (!announcement.enabled || !announcement.id) return;

        const lastSeenId = await DataStore.get<string>(SEEN_ANNOUNCEMENT_KEY);
        if (announcement.id === lastSeenId) return;

        await DataStore.set(SEEN_ANNOUNCEMENT_KEY, announcement.id);

        showNotification({
            title: announcement.title,
            body: announcement.body,
            onClick: announcement.url
                ? () => VencordNative.native.openExternal(announcement.url!)
                : undefined
        });
    } catch (e) {
        logger.error("Failed to check announcement", e);
    }
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
        checkAnnouncement();
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
