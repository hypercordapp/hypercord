/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    passphrase: {
        type: OptionType.STRING,
        description: "Shared passphrase used to encrypt/decrypt messages. Everyone in the conversation needs the same passphrase and this plugin enabled.",
        default: ""
    },
    encryptOutgoing: {
        type: OptionType.BOOLEAN,
        description: "Encrypt your outgoing messages when a passphrase is set",
        default: true
    }
});
