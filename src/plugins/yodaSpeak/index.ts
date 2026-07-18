/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

function yodafy(sentence: string): string {
    const trailingPunct = sentence.match(/[.!?]+$/)?.[0] ?? "";
    const body = trailingPunct ? sentence.slice(0, -trailingPunct.length) : sentence;

    const words = body.trim().split(/\s+/);
    if (words.length < 3) return sentence;

    const splitPoint = Math.max(1, Math.floor(words.length / 2));
    const first = words.slice(0, splitPoint);
    const second = words.slice(splitPoint);

    return `${second.join(" ")}, ${first.join(" ")}${trailingPunct || "."}`;
}

export default definePlugin({
    name: "YodaSpeak",
    description: "Reorder your sentences to sound like Yoda, they will",
    tags: ["Fun", "Chat"],
    authors: [Devs.HyperCordTeam],

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;
        msg.content = msg.content
            .split(/(?<=[.!?])\s+/)
            .map(yodafy)
            .join(" ");
    }
});
