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
    abbreviations: {
        type: OptionType.STRING,
        description: "One abbreviation=expansion pair per line",
        default: "brb=be right back\nidk=i don't know\nimo=in my opinion\nafaik=as far as I know\nomw=on my way",
        multiline: true
    }
});

function parseRules(): Map<string, string> {
    const map = new Map<string, string>();
    for (const line of settings.store.abbreviations.split("\n")) {
        const idx = line.indexOf("=");
        if (idx === -1) continue;

        const key = line.slice(0, idx).trim().toLowerCase();
        const value = line.slice(idx + 1).trim();
        if (key && value) map.set(key, value);
    }
    return map;
}

export default definePlugin({
    name: "Abbreviation",
    description: "Automatically expands your own shorthand abbreviations (like brb, idk) into full words before sending",
    tags: ["Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;

        const rules = parseRules();
        if (!rules.size) return;

        msg.content = msg.content.replace(/\b[a-zA-Z']+\b/g, word => {
            const expansion = rules.get(word.toLowerCase());
            if (!expansion) return word;

            // Whole-word-uppercase abbreviations (e.g. "BRB") expand in kind -
            // anything else (including normal or Capitalized typing) just
            // gets the expansion as authored in settings.
            return word === word.toUpperCase() && word.length > 1
                ? expansion.toUpperCase()
                : expansion;
        });
    }
});
