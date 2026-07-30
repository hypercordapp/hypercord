/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const STYLE_ID = "hypercord-wallpaper-studio-style";
const IMG_ID = "hypercord-wallpaper-studio-img";

interface Preset { dim: number; blur: number; saturate: number; }

// Each preset is just a different dim/blur/saturation combo tuned so Discord's
// own panels (made translucent via the same OledBlack-proven CSS custom
// properties, see below) stay readable over very different kinds of images -
// a bright vibrant photo needs more dim than a already-dark moody one.
const PRESETS: Record<string, Preset> = {
    cinematic: { dim: 55, blur: 2, saturate: 90 },
    vibrant: { dim: 25, blur: 0, saturate: 130 },
    dark: { dim: 75, blur: 1, saturate: 80 },
    minimal: { dim: 85, blur: 4, saturate: 60 },
    custom: { dim: 50, blur: 0, saturate: 100 }
};

const settings = definePluginSettings({
    imageUrl: {
        type: OptionType.STRING,
        description: "Wallpaper image URL (leave empty to disable)",
        default: "",
        onChange: () => apply()
    },
    preset: {
        type: OptionType.SELECT,
        description: "Theme - each one tunes dim/blur/saturation together so the wallpaper stays cohesive with Discord's own UI instead of just slapping the raw image behind everything",
        options: [
            { label: "Cinematic", value: "cinematic", default: true },
            { label: "Vibrant", value: "vibrant" },
            { label: "Dark", value: "dark" },
            { label: "Minimal", value: "minimal" },
            { label: "Custom (use sliders below)", value: "custom" }
        ],
        onChange: () => apply()
    },
    customDim: {
        type: OptionType.SLIDER,
        description: "Custom: how dark the panels are over the image (only used when theme is Custom)",
        markers: [0, 20, 40, 60, 80, 100],
        default: 50,
        stickToMarkers: false,
        onChange: () => apply()
    },
    customBlur: {
        type: OptionType.SLIDER,
        description: "Custom: background blur in pixels (only used when theme is Custom)",
        markers: [0, 2, 4, 6, 8, 10],
        default: 0,
        stickToMarkers: false,
        onChange: () => apply()
    },
    customSaturation: {
        type: OptionType.SLIDER,
        description: "Custom: image saturation % (only used when theme is Custom)",
        markers: [50, 75, 100, 125, 150],
        default: 100,
        stickToMarkers: false,
        onChange: () => apply()
    }
});

function getEffectivePreset(): Preset {
    if (settings.store.preset === "custom") {
        return {
            dim: settings.store.customDim,
            blur: settings.store.customBlur,
            saturate: settings.store.customSaturation
        };
    }
    return PRESETS[settings.store.preset] ?? PRESETS.cinematic;
}

function clear() {
    document.getElementById(IMG_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
}

// Same "make Discord's real panel backgrounds transparent, layer an image
// behind them" technique LiveWallpaper/ChannelWallpaper already use (built on
// OledBlack's proven --background-primary etc. custom properties) - this
// plugin's own value-add is the preset system tuning dim/blur/saturation
// together instead of a single flat overlay.
function apply() {
    if (!settings.store.imageUrl) {
        clear();
        return;
    }

    const { dim, blur, saturate } = getEffectivePreset();

    let img = document.getElementById(IMG_ID) as HTMLDivElement | null;
    if (!img) {
        img = document.createElement("div");
        img.id = IMG_ID;
        Object.assign(img.style, {
            position: "fixed",
            inset: "0",
            // No negative z-index on purpose - a negative z-index can end up
            // painted behind <body>'s own background layer entirely
            // (browsers treat that as a separate paint layer from the normal
            // DOM stacking context), making the wallpaper invisible no matter
            // what the image URL is. Prepending as body's first child and
            // letting Discord's real UI (which comes after it in the DOM)
            // naturally stack on top at the default z-index is reliable
            // instead.
            zIndex: "0",
            backgroundSize: "cover",
            backgroundPosition: "center",
            pointerEvents: "none",
            transition: "filter 0.3s ease"
        });
        document.body.prepend(img);
    }
    img.style.backgroundImage = `url("${settings.store.imageUrl}")`;
    img.style.filter = `blur(${blur}px) saturate(${saturate}%)`;

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }

    const alpha = dim / 100;
    const floatingAlpha = Math.min(1, alpha + 0.15);
    style.textContent = `
        html, body {
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
    name: "WallpaperStudio",
    description: "Sets a custom background image behind Discord with built-in themes (Cinematic, Vibrant, Dark, Minimal, or Custom) that keep it readable instead of just overlaying the raw image",
    tags: ["Appearance"],
    authors: [Devs.HyperCordTeam],
    settings,

    start: apply,
    stop: clear
});
