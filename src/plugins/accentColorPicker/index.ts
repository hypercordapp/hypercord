/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const STYLE_ID = "hypercord-accent-color";

function isValidHex(hex: string): boolean {
    return /^#?[0-9a-fA-F]{6}$/.test(hex.trim());
}

function buildCss() {
    const hex = settings.store.color.trim();
    if (!isValidHex(hex)) return "";
    const color = hex.startsWith("#") ? hex : `#${hex}`;

    return `
:root {
    --brand-500: ${color} !important;
    --brand-560: ${color} !important;
    --brand-experiment: ${color} !important;
    --text-link: ${color} !important;
}
`;
}

const settings = definePluginSettings({
    color: {
        type: OptionType.STRING,
        description: "Hex color to use for Discord's accent/brand color, e.g. #ff6b6b",
        default: "#5865F2",
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
    name: "AccentColorPicker",
    description: "Overrides Discord's default blurple accent color with a custom hex color of your choice",
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
