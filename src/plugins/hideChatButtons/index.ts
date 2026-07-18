/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const STYLE_ID = "hypercord-hide-chat-buttons";

function buildCss() {
    const rules: string[] = [];
    if (settings.store.hideGift) rules.push('[aria-label="Send a gift"]');
    if (settings.store.hideGif) rules.push('[aria-label="Open GIF picker"]');
    if (settings.store.hideSticker) rules.push('[aria-label="Open sticker picker"]');
    if (settings.store.hideApps) rules.push('[aria-label="Use Apps"]');

    if (!rules.length) return "";
    return `${rules.join(", ")} { display: none !important; }`;
}

const settings = definePluginSettings({
    hideGift: { type: OptionType.BOOLEAN, description: "Hide the gift/nitro button", default: true, onChange: applyCss },
    hideGif: { type: OptionType.BOOLEAN, description: "Hide the GIF picker button", default: false, onChange: applyCss },
    hideSticker: { type: OptionType.BOOLEAN, description: "Hide the sticker picker button", default: false, onChange: applyCss },
    hideApps: { type: OptionType.BOOLEAN, description: "Hide the 'Use Apps' button", default: false, onChange: applyCss },
});

function applyCss() {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }
    style.textContent = buildCss();
}

export default definePlugin({
    name: "HideChatButtons",
    description: "Selectively hide buttons in the chat input bar (gift, GIF, sticker, apps)",
    tags: ["Appearance", "Chat"],
    authors: [Devs.HyperCordTeam],
    settings,

    start() {
        applyCss();
    },

    stop() {
        document.getElementById(STYLE_ID)?.remove();
    }
});
