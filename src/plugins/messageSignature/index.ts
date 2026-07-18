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
    signature: {
        type: OptionType.STRING,
        description: "Text to automatically append to every message you send",
        default: ""
    },
    separator: {
        type: OptionType.STRING,
        description: "Separator placed between your message and the signature",
        default: " — "
    }
});

export default definePlugin({
    name: "MessageSignature",
    description: "Automatically appends a custom signature to every outgoing message",
    tags: ["Chat", "Customisation"],
    authors: [Devs.HyperCordTeam],
    settings,

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content || !settings.store.signature) return;
        if (msg.content.includes(settings.store.signature)) return;

        msg.content = `${msg.content}${settings.store.separator}${settings.store.signature}`;
    }
});
