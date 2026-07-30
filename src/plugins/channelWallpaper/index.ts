/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, SelectedChannelStore, Toasts } from "@webpack/common";

const STYLE_ID = "hypercord-channel-wallpaper-style";

// Discord's CSP silently blocks loading images from domains it doesn't
// already trust - no visible error, the background-image request just
// never completes. This is the actual root cause of "the wallpaper doesn't
// show up at all" (found via src/main/csp/manager.ts/index.ts), CSS alone
// can't fix it. Same request-permission flow SettingsSync's cloudSetup.tsx
// already uses for connect-src, just for img-src instead.
const checkedDomains = new Set<string>();
async function checkImageCsp(url: string): Promise<boolean> {
    if (IS_WEB) return true;

    if (await VencordNative.csp.isDomainAllowed(url, ["img-src"])) return true;

    // ChannelWallpaper can hold many channelId=url entries at once, each
    // switched to on every channel change - only prompt once per domain per
    // session instead of re-asking on every single switch to that channel.
    const { host } = new URL(url);
    if (checkedDomains.has(host)) return false;
    checkedDomains.add(host);

    const res = await VencordNative.csp.requestAddOverride(url, ["img-src"], "ChannelWallpaper");
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
    document.getElementById(STYLE_ID)?.remove();
}

// Sets the image as body's OWN background-image rather than a separate fixed
// div - a separate div needs a z-index guess relative to Discord's own root
// mount that isn't reliably in a known-safe stacking position, whereas a
// background-image is painted as the element's own backdrop by definition,
// so every one of body's children renders on top of it with no
// stacking-order guess needed at all. #app-mount (Discord's real React root,
// a stable id long used by every external theme/injector tool) is force-
// transparented too, since OledBlack's proven --background-primary etc.
// custom properties only recolor Discord's own panels, not whatever the root
// mount div itself paints. Scoped to whichever channel is currently open.
async function applyForCurrentChannel() {
    const channelId = SelectedChannelStore.getChannelId();
    const url = channelId ? parseWallpapers().get(channelId) : undefined;

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

    if (!url) {
        clear();
        return;
    }

    if (!await checkImageCsp(url)) return;

    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }

    const alpha = (100 - settings.store.opacity) / 100;

    style.textContent = `
        html, body {
            background-image: url("${url}") !important;
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
