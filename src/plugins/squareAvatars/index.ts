/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const STYLE_ID = "hypercord-square-avatars";

function buildCss() {
    const radius = `${settings.store.borderRadius}px`;
    return `
[class*="avatar"] img, img[class*="avatar"] {
    border-radius: ${radius} !important;
}
`;
}

const settings = definePluginSettings({
    borderRadius: {
        type: OptionType.SLIDER,
        description: "Corner roundness in pixels (0 = fully square)",
        markers: [0, 4, 8, 16, 24],
        default: 0,
        stickToMarkers: false,
        onChange: applyCss
    }
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
    name: "SquareAvatars",
    description: "Makes user avatars square (or any corner roundness you like) instead of circular",
    tags: ["Appearance", "Customisation"],
    authors: [Devs.HyperCordTeam],
    settings,

    start() {
        applyCss();
    },

    stop() {
        document.getElementById(STYLE_ID)?.remove();
    }
});
