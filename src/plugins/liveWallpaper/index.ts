/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const STYLE_ID = "hypercord-live-wallpaper-style";

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

function clear() {
    document.getElementById(STYLE_ID)?.remove();
}

// Sets the image as body's OWN background-image rather than a separate
// fixed div - a separate div needs a z-index guess relative to Discord's own
// root mount that isn't reliably in a known-safe stacking position, whereas
// a background-image is painted as the element's own backdrop by
// definition, so every one of body's children renders on top of it with no
// stacking-order guess needed at all. #app-mount (Discord's real React root,
// a stable id long used by every external theme/injector tool) is force-
// transparented too, since OledBlack's proven --background-primary etc.
// custom properties only recolor Discord's own panels, not whatever the
// root mount div itself paints.
function apply() {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

    if (!settings.store.imageUrl) {
        clear();
        return;
    }

    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }

    const alpha = (100 - settings.store.opacity) / 100;
    const floatingAlpha = Math.min(1, alpha + 0.2);

    style.textContent = `
        html, body {
            background-image: url("${settings.store.imageUrl}") !important;
            background-size: cover !important;
            background-position: center !important;
            background-attachment: fixed !important;
            background-repeat: no-repeat !important;
        }
        #app-mount {
            background: transparent !important;
        }
        :root {
            --background-primary: rgba(0, 0, 0, ${alpha}) !important;
            --background-secondary: rgba(0, 0, 0, ${alpha}) !important;
            --background-secondary-alt: rgba(0, 0, 0, ${alpha}) !important;
            --background-tertiary: rgba(0, 0, 0, ${alpha}) !important;
            --background-floating: rgba(0, 0, 0, ${floatingAlpha}) !important;
            --channeltextarea-background: rgba(0, 0, 0, ${floatingAlpha}) !important;
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
    stop: clear
});
