/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const STYLE_ID = "hypercord-custom-font";

const settings = definePluginSettings({
    fontFamily: {
        type: OptionType.STRING,
        description: "Font family to use across Discord's UI (must be installed on your system or a web-safe font)",
        default: "Comic Sans MS",
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

    const font = settings.store.fontFamily.trim();
    style.textContent = font
        ? `:root { --font-primary: "${font}", sans-serif !important; --font-display: "${font}", sans-serif !important; }`
        : "";
}

export default definePlugin({
    name: "CustomFont",
    description: "Overrides Discord's UI font with a custom font family of your choice",
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
