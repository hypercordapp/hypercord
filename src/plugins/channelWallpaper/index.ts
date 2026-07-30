/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, SelectedChannelStore } from "@webpack/common";

const STYLE_ID = "hypercord-channel-wallpaper-style";
const IMG_ID = "hypercord-channel-wallpaper-img";

const settings = definePluginSettings({
    wallpapers: {
        type: OptionType.STRING,
        description: "One channelId=imageUrl pair per line - open the channel, copy its ID (Developer Mode), and add a line here",
        default: "",
        multiline: true,
        onChange: () => applyForCurrentChannel()
    },
    opacity: {
        type: OptionType.SLIDER,
        description: "How visible the wallpaper is through the panels above it",
        markers: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        default: 40,
        stickToMarkers: true,
        onChange: () => applyForCurrentChannel()
    }
});

function parseWallpapers(): Map<string, string> {
    const map = new Map<string, string>();
    for (const line of settings.store.wallpapers.split("\n")) {
        const idx = line.indexOf("=");
        if (idx === -1) continue;
        const channelId = line.slice(0, idx).trim();
        const url = line.slice(idx + 1).trim();
        if (channelId && url) map.set(channelId, url);
    }
    return map;
}

function clear() {
    document.getElementById(IMG_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
}

// Same "make the real panel backgrounds transparent, layer an image behind
// them" technique as LiveWallpaper (built on OledBlack's already-proven CSS
// custom properties) - just scoped to whichever channel is currently open.
function applyForCurrentChannel() {
    const channelId = SelectedChannelStore.getChannelId();
    const url = channelId ? parseWallpapers().get(channelId) : undefined;

    if (!url) {
        clear();
        return;
    }

    let img = document.getElementById(IMG_ID) as HTMLDivElement | null;
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
    img.style.backgroundImage = `url("${url}")`;

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
            --channeltextarea-background: rgba(0, 0, 0, ${Math.min(1, alpha + 0.2)}) !important;
        }
    `;
}

export default definePlugin({
    name: "ChannelWallpaper",
    description: "Set a different background image for individual channels",
    tags: ["Appearance"],
    authors: [Devs.HyperCordTeam],
    settings,

    start() {
        applyForCurrentChannel();
        FluxDispatcher.subscribe("CHANNEL_SELECT", applyForCurrentChannel);
    },

    stop() {
        FluxDispatcher.unsubscribe("CHANNEL_SELECT", applyForCurrentChannel);
        clear();
    }
});
