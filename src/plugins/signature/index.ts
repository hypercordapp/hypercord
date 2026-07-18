/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";

const SIGIL_EMOJIS = ["🐺", "🍀", "✨", "🔥", "🌙", "⚡", "🌊", "🍁", "🦊", "💎", "🌸", "🪐", "🎭", "🕊️", "🦋", "🌵"];

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Append your personal emoji sigil to outgoing messages",
        default: true
    },
    sigilLength: {
        type: OptionType.SLIDER,
        description: "How many emojis your sigil should contain",
        markers: [1, 2, 3, 4, 5],
        default: 3,
        stickToMarkers: true
    }
});

function hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash;
}

function getSigil(userId: string, length: number): string {
    let seed = hashString(userId);
    const emojis: string[] = [];
    for (let i = 0; i < length; i++) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        emojis.push(SIGIL_EMOJIS[seed % SIGIL_EMOJIS.length]);
    }
    return emojis.join("");
}

export default definePlugin({
    name: "Signature",
    description: "Automatically signs your outgoing messages with a unique emoji sigil derived from your user ID",
    tags: ["Experimental", "Fun", "Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!settings.store.enabled || !msg.content) return;

        const self = UserStore.getCurrentUser();
        if (!self) return;

        const sigil = getSigil(self.id, settings.store.sigilLength);
        msg.content = `${msg.content} ${sigil}`;
    }
});
