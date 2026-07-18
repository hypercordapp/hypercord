/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const LEET_MAP: Record<string, string> = {
    a: "4", e: "3", i: "1", o: "0", s: "5", t: "7", l: "1", g: "9", b: "8"
};

export default definePlugin({
    name: "LeetSpeak",
    description: "C0nv3r75 y0ur m3554935 1n70 1337sp34k",
    tags: ["Fun", "Chat"],
    authors: [Devs.HyperCordTeam],

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;
        msg.content = msg.content.replace(/[a-zA-Z]/g, char => LEET_MAP[char.toLowerCase()] ?? char);
    }
});
