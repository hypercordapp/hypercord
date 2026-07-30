/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const STYLE_ID = "hypercord-live-wallpaper-style";
const IMG_ID = "hypercord-live-wallpaper-img";

const settings = definePluginSettings({
    imageUrl: {
        type: OptionType.STRING,
        description: "Wallpaper image URL, shown behind the whole Discord window (leave empty to disable)",
        default: "",
        onChange: () => apply()
    },
    opacity: {
        type: OptionType.SLIDER,
        description: "How visible the wallpaper is through the panels above it",
        markers: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        default: 40,
        stickToMarkers: true,
        onChange: () => apply()
    }
});

// Same CSS custom properties OledBlack already proves control Discord's real
// panel backgrounds - set to transparent instead of a solid color here so a
// fixed background image behind everything shows through.
function apply() {
    let img = document.getElementById(IMG_ID) as HTMLDivElement | null;
    if (!settings.store.imageUrl) {
        img?.remove();
        document.getElementById(STYLE_ID)?.remove();
        return;
    }

    if (!img) {
        img = document.createElement("div");
        img.id = IMG_ID;
        Object.assign(img.style, {
            position: "fixed",
            inset: "0",
            // No negative z-index - it can end up painted behind <body>'s own
            // background layer entirely, making the wallpaper invisible
            // regardless of the image URL. Prepending as body's first child
            // and letting Discord's real UI stack on top naturally (it comes
            // later in the DOM) is reliable instead.
            zIndex: "0",
            backgroundSize: "cover",
            backgroundPosition: "center",
            pointerEvents: "none"
        });
        document.body.prepend(img);
    }
    img.style.backgroundImage = `url("${settings.store.imageUrl}")`;

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }

    const alpha = (100 - settings.store.opacity) / 100;
    style.textContent = `
        html, body {
            background: transparent !important;
        }
        :root {
            --background-primary: rgba(0, 0, 0, ${alpha}) !important;
            --background-secondary: rgba(0, 0, 0, ${alpha}) !important;
            --background-secondary-alt: rgba(0, 0, 0, ${alpha}) !important;
            --background-tertiary: rgba(0, 0, 0, ${alpha}) !important;
            --background-floating: rgba(0, 0, 0, ${Math.min(1, alpha + 0.2)}) !important;
            --channeltextarea-background: rgba(0, 0, 0, ${Math.min(1, alpha + 0.2)}) !important;
        }
    `;
}

export default definePlugin({
    name: "LiveWallpaper",
    description: "Sets a global background image behind the entire Discord interface",
    tags: ["Appearance"],
    authors: [Devs.HyperCordTeam],
    settings,

    start: apply,
    stop() {
        document.getElementById(IMG_ID)?.remove();
        document.getElementById(STYLE_ID)?.remove();
    }
});
