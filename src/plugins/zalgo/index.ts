/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const ZALGO_UP = ["̍", "̎", "̄", "̅", "̿", "̑", "̆", "̐", "͒", "͗", "͑", "̇", "̈", "̊", "͂", "̓", "̈", "͊", "͋", "͌", "̃", "̂", "̌", "͐", "̀", "́", "̋", "̏", "̒", "̓", "̔", "̽", "̉", "ͣ", "ͤ", "ͥ", "ͦ", "ͧ", "ͨ", "ͩ", "ͪ", "ͫ", "ͬ", "ͭ", "ͮ", "ͯ", "̾", "͛", "͆", "̚"];
const ZALGO_DOWN = ["̖", "̗", "̘", "̙", "̜", "̝", "̞", "̟", "̠", "̤", "̥", "̦", "̩", "̪", "̫", "̬", "̭", "̮", "̯", "̰", "̱", "̲", "̳", "̹", "̺", "̻", "̼", "ͅ", "͇", "͈", "͉", "͍", "͎", "͓", "͔", "͕", "͖", "͙", "͚", "̣"];

const settings = definePluginSettings({
    intensity: {
        type: OptionType.SLIDER,
        description: "How cursed your text should look",
        markers: [1, 3, 5, 8, 12],
        default: 4,
        stickToMarkers: false
    }
});

function zalgofy(text: string): string {
    return [...text].map(char => {
        if (/\s/.test(char)) return char;
        let out = char;
        const count = Math.max(1, Math.floor(settings.store.intensity));
        for (let i = 0; i < count; i++) out += ZALGO_UP[Math.floor(Math.random() * ZALGO_UP.length)];
        for (let i = 0; i < count; i++) out += ZALGO_DOWN[Math.floor(Math.random() * ZALGO_DOWN.length)];
        return out;
    }).join("");
}

export default definePlugin({
    name: "Zalgo",
    description: "H̸̬̽e̶̼̍ ̷̜̈c̴̗̀o̶̢̕m̷͖̌e̸̻͐s̶̡̈ - corrupts your outgoing messages with zalgo text",
    tags: ["Fun", "Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;
        msg.content = zalgofy(msg.content);
    }
});
