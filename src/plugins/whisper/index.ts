/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "Whisper",
    description: "makes your outgoing messages look like a soft whisper",
    tags: ["Fun", "Chat"],
    authors: [Devs.HyperCordTeam],

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;

        const content = msg.content.toLowerCase().replace(/!+/g, ".");
        msg.content = `*(whispers) ${content}*`;
    }
});
