/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "SpoilerAll",
    description: "Automatically wraps every outgoing message in spoiler tags",
    tags: ["Chat", "Fun"],
    authors: [Devs.HyperCordTeam],

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;
        if (msg.content.startsWith("||") && msg.content.endsWith("||")) return;

        msg.content = `||${msg.content}||`;
    }
});
