/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "Shout",
    description: "MAKES ALL YOUR OUTGOING MESSAGES SHOUTY!!!",
    tags: ["Fun", "Chat"],
    authors: [Devs.HyperCordTeam],

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;

        msg.content = msg.content.toUpperCase();
        if (!/[!?]$/.test(msg.content.trim())) msg.content = msg.content.trimEnd() + "!!!";
    }
});
