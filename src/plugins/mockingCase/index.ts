/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "MockingCase",
    description: "tUrNs yOuR mEsSaGeS iNtO mOcKiNg sPoNgEbOb cAsE",
    tags: ["Fun", "Chat"],
    authors: [Devs.HyperCordTeam],

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;

        let upper = false;
        msg.content = [...msg.content].map(char => {
            if (!/[a-zA-Z]/.test(char)) return char;
            upper = !upper;
            return upper ? char.toUpperCase() : char.toLowerCase();
        }).join("");
    }
});
