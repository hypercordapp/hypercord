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
    emoji: {
        type: OptionType.STRING,
        description: "The emoji to insert between words",
        default: "👏"
    },
    trailing: {
        type: OptionType.BOOLEAN,
        description: "Also add the emoji at the start and end of the message",
        default: true
    }
});

export default definePlugin({
    name: "ClapText",
    description: "👏 Inserts 👏 an 👏 emoji 👏 between 👏 every 👏 word 👏 of 👏 your 👏 messages",
    tags: ["Fun", "Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;
        const emoji = settings.store.emoji || "👏";
        const words = msg.content.split(" ").filter(Boolean);
        if (!words.length) return;

        let result = words.join(` ${emoji} `);
        if (settings.store.trailing) result = `${emoji} ${result} ${emoji}`;
        msg.content = result;
    }
});
