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
    chance: {
        type: OptionType.SLIDER,
        description: "Chance (%) per word to add a stutter",
        markers: [0, 25, 50, 75, 100],
        default: 30,
        stickToMarkers: false
    }
});

export default definePlugin({
    name: "Stutter",
    description: "M-makes you s-stutter r-randomly in your m-messages",
    tags: ["Fun", "Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;

        msg.content = msg.content.replace(/\b([A-Za-z])([A-Za-z]*)/g, (whole, first, rest) => {
            if (Math.random() * 100 > settings.store.chance) return whole;
            return `${first}-${first}${rest}`;
        });
    }
});
