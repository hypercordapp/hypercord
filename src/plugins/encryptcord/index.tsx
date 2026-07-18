/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

import { encryptText } from "./crypto";
import { DecryptedAccessory } from "./DecryptedAccessory";
import { settings } from "./settings";

export default definePlugin({
    name: "Encryptcord",
    description: "Encrypts your outgoing messages with a shared passphrase using AES-GCM. Only people with the same passphrase and this plugin can read them.",
    tags: ["Experimental", "Privacy", "Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    renderMessageAccessory: props => <DecryptedAccessory message={props.message} />,

    async onBeforeMessageSend(_, msg: MessageObject) {
        if (!settings.store.encryptOutgoing || !settings.store.passphrase || !msg.content) return;

        msg.content = await encryptText(msg.content, settings.store.passphrase);
    }
});
