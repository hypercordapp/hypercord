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
    mode: {
        type: OptionType.SELECT,
        description: "What to reverse",
        options: [
            { label: "Reverse the whole message (characters)", value: "chars", default: true },
            { label: "Reverse word order only", value: "words" }
        ]
    }
});

export default definePlugin({
    name: "TalkInReverse",
    description: "Reverses your outgoing messages",
    tags: ["Fun", "Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;

        msg.content = settings.store.mode === "words"
            ? msg.content.split(" ").reverse().join(" ")
            : [...msg.content].reverse().join("");
    }
});
