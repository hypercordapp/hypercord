/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const SOUNDS = ["meow", "nya", "mrrp", "purr~", "mew"];

const settings = definePluginSettings({
    chance: {
        type: OptionType.SLIDER,
        description: "Chance (%) that a cat sound gets appended to your messages",
        markers: [0, 25, 50, 75, 100],
        default: 100,
        stickToMarkers: false
    }
});

export default definePlugin({
    name: "Meow",
    description: "Randomly appends a cat sound to your outgoing messages",
    tags: ["Fun", "Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;
        if (Math.random() * 100 > settings.store.chance) return;

        const sound = SOUNDS[Math.floor(Math.random() * SOUNDS.length)];
        msg.content = `${msg.content} ${sound}`;
    }
});
