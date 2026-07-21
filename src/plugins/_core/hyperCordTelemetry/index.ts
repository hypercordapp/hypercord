/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, UserStore } from "@webpack/common";

const TELEMETRY_URL = "https://api.hypercord.pro/telemetry/ping";
const logger = new Logger("HyperCordTelemetry");

export const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Let the HyperCord team see that you use HyperCord (sends your user ID and current username once per session, nothing else)",
        default: true
    }
});

function ping() {
    if (!settings.store.enabled) return;

    const user = UserStore.getCurrentUser();
    if (!user) return;

    fetch(TELEMETRY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, username: user.username })
    }).catch(e => logger.error("Failed to report usage", e));
}

export default definePlugin({
    name: "HyperCordTelemetry",
    description: "Reports that you use HyperCord (user ID + current username, nothing more) to HyperCord's own backend, so the team can see real usage numbers. Toggle off below to opt out.",
    authors: [Devs.HyperCordTeam],
    required: true,
    settings,

    start() {
        ping();
        FluxDispatcher.subscribe("CONNECTION_OPEN", ping);
    },

    stop() {
        FluxDispatcher.unsubscribe("CONNECTION_OPEN", ping);
    }
});
