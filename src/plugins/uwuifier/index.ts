/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const FACES = ["UwU", "OwO", ">w<", "^w^", "(・`ω´・)", "( ˘ω˘ )"];

const settings = definePluginSettings({
    addFaces: {
        type: OptionType.BOOLEAN,
        description: "Randomly sprinkle in cute faces like UwU / OwO",
        default: true
    },
    stutter: {
        type: OptionType.BOOLEAN,
        description: "Randomly s-stutter the first letter of some words",
        default: true
    }
});

function uwuify(text: string): string {
    let result = text
        .replace(/[rl]/g, "w")
        .replace(/[RL]/g, "W")
        .replace(/n([aeiou])/g, "ny$1")
        .replace(/N([aeiouAEIOU])/g, "Ny$1")
        .replace(/ove/g, "uv")
        .replace(/!+/g, () => Math.random() < 0.5 ? " " + FACES[Math.floor(Math.random() * FACES.length)] : "!");

    if (settings.store.stutter) {
        result = result.replace(/\b([A-Za-z])([A-Za-z]{2,})/g, (m, first, rest) =>
            Math.random() < 0.12 ? `${first}-${first}${rest}` : m
        );
    }

    if (settings.store.addFaces && Math.random() < 0.35) {
        result += " " + FACES[Math.floor(Math.random() * FACES.length)];
    }

    return result;
}

export default definePlugin({
    name: "UwUifier",
    description: "UwUifies your outgoing messages",
    tags: ["Fun", "Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;
        msg.content = uwuify(msg.content);
    }
});
