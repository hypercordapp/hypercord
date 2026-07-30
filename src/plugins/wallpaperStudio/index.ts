/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Toasts } from "@webpack/common";

const STYLE_ID = "hypercord-wallpaper-studio-style";

// Discord's CSP blocks loading images from domains it doesn't already trust -
// silently, no visible error, the background-image request just never
// completes. This is the actual root cause of "the wallpaper doesn't show
// up at all" reports (found via src/main/csp/manager.ts/index.ts) - CSS
// alone can never fix this, the domain has to be added to the allowlist
// first. Same request-permission flow SettingsSync's cloudSetup.tsx already
// uses for connect-src, just for img-src instead.
async function checkImageCsp(url: string): Promise<boolean> {
    if (IS_WEB) return true;

    if (await VencordNative.csp.isDomainAllowed(url, ["img-src"])) return true;

    const res = await VencordNative.csp.requestAddOverride(url, ["img-src"], "WallpaperStudio");
    if (res === "ok") {
        Toasts.show({
            id: Toasts.genId(),
            message: "Domain allowed - fully restart Discord for the wallpaper to actually show up.",
            type: Toasts.Type.SUCCESS
        });
    } else if (res !== "cancelled") {
        Toasts.show({
            id: Toasts.genId(),
            message: "Couldn't get permission to load images from that domain, so the wallpaper won't show.",
            type: Toasts.Type.FAILURE
        });
    }
    return res === "ok";
}

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
    document.getElementById(STYLE_ID)?.remove();
}

// Rewritten after the first version (a separate fixed div with z-index: 0)
// still didn't reliably show through for everyone - that approach depends on
// exactly where in the DOM the div ends up relative to Discord's own root
// mount, which isn't guaranteed. Setting the image as body's OWN
// background-image sidesteps stacking-order entirely: a background-image is
// painted as the element's own backdrop by definition, so every one of
// body's children renders on top of it with no z-index/paint-order game
// needed at all. #app-mount (Discord's actual React root, a stable id used
// by every theme/injector tool for years) is force-transparented too, since
// OledBlack's proven --background-primary etc. custom properties only
// affect Discord's own panel colors, not whatever the root mount div itself
// paints.
async function apply() {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

    if (!settings.store.imageUrl) {
        clear();
        return;
    }

    if (!await checkImageCsp(settings.store.imageUrl)) return;

    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }

    const { dim, blur, saturate } = getEffectivePreset();
    const alpha = dim / 100;
    const floatingAlpha = Math.min(1, alpha + 0.15);

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
            backdrop-filter: blur(${blur}px) saturate(${saturate}%);
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
