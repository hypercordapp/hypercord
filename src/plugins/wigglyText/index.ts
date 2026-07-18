/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const WIGGLE_MARKS = ["̌", "̂", "̰", "̳", "́", "̀"];

const settings = definePluginSettings({
    intensity: {
        type: OptionType.SLIDER,
        description: "How wiggly your text should be (marks per letter)",
        markers: [1, 2, 3, 4],
        default: 1,
        stickToMarkers: true
    }
});

function wigglify(text: string): string {
    return text.replace(/\S/gu, char => {
        if (/\s/.test(char)) return char;
        let out = char;
        for (let i = 0; i < settings.store.intensity; i++) {
            out += WIGGLE_MARKS[Math.floor(Math.random() * WIGGLE_MARKS.length)];
        }
        return out;
    });
}

export default definePlugin({
    name: "WigglyText",
    description: "Makes your outgoing text look wiggly using combining diacritics",
    tags: ["Fun", "Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;
        msg.content = wigglify(msg.content);
    }
});
