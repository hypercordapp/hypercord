/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    windowSeconds: {
        type: OptionType.SLIDER,
        description: "How many seconds to block an identical repeated message",
        markers: [2, 5, 10, 15, 30],
        default: 5,
        stickToMarkers: false
    }
});

const lastSent = new Map<string, { content: string; time: number; }>();

export default definePlugin({
    name: "NoDoubleSend",
    description: "Blocks accidentally sending the exact same message twice in a row in the same channel within a short window",
    tags: ["Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    onBeforeMessageSend(channelId, msg: MessageObject) {
        if (!msg.content) return;

        const now = Date.now();
        const prev = lastSent.get(channelId);

        if (prev && prev.content === msg.content && now - prev.time < settings.store.windowSeconds * 1000) {
            return { cancel: true };
        }

        lastSent.set(channelId, { content: msg.content, time: now });
    }
});
