/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";

const settings = definePluginSettings({
    mode: {
        type: OptionType.SELECT,
        description: "What to do when a mostly-uppercase message is detected",
        options: [
            { label: "Auto lowercase the message", value: "fix", default: true },
            { label: "Just warn with a toast, don't change it", value: "warn" }
        ]
    },
    minLength: {
        type: OptionType.SLIDER,
        description: "Minimum message length to check (avoids flagging short acronyms like 'LOL')",
        markers: [4, 6, 8, 10, 15],
        default: 6,
        stickToMarkers: false
    }
});

function isMostlyUpper(text: string): boolean {
    const letters = text.replace(/[^a-zA-Z]/g, "");
    if (letters.length < settings.store.minLength) return false;

    const upper = letters.replace(/[^A-Z]/g, "").length;
    return upper / letters.length > 0.7;
}

export default definePlugin({
    name: "CapsLockWarning",
    description: "Warns you or auto-fixes messages that are accidentally typed in ALL CAPS",
    tags: ["Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content || !isMostlyUpper(msg.content)) return;

        if (settings.store.mode === "fix") {
            msg.content = msg.content.toLowerCase();
        } else {
            showToast("Heads up, that message looks like it's in ALL CAPS!", Toasts.Type.MESSAGE);
        }
    }
});
