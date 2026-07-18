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
    keywords: {
        type: OptionType.STRING,
        description: "Comma-separated list of words that will block your message from being sent",
        default: ""
    }
});

function getKeywords(): string[] {
    return settings.store.keywords
        .split(",")
        .map(w => w.trim().toLowerCase())
        .filter(Boolean);
}

export default definePlugin({
    name: "BlockKeywords",
    description: "Prevents you from accidentally sending messages that contain certain keywords",
    tags: ["Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;
        const lower = msg.content.toLowerCase();
        const keywords = getKeywords();

        if (keywords.some(k => lower.includes(k))) {
            return { cancel: true };
        }
    }
});
