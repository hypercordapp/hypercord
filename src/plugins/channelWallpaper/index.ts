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

function toast(message: string, type: string) {
    Toasts.show({ id: Toasts.genId(), message, type });
}

// Discord's CSP silently blocks loading images from domains it doesn't
// already trust - no visible error, the background-image request just
// never completes. This is the actual root cause of "the wallpaper doesn't
// show up at all" (found via src/main/csp/manager.ts/index.ts), CSS alone
// can't fix it. Same request-permission flow SettingsSync's cloudSetup.tsx
// already uses for connect-src, just for img-src instead.
//
// Every branch below toasts something on purpose, even the "already fine"
// ones - if the wallpaper still doesn't show up after this, the toast text
// tells us exactly which step it got stuck on instead of guessing blind.
const checkedDomains = new Set<string>();
async function checkImageCsp(url: string): Promise<boolean> {
    if (IS_WEB) return true;

    let host: string;
    try {
        host = new URL(url).host;
    } catch {
        toast("ChannelWallpaper: that's not a valid URL.", Toasts.Type.FAILURE);
        return false;
    }

    try {
        if (await VencordNative.csp.isDomainAllowed(url, ["img-src"])) {
            return true;
        }

        // ChannelWallpaper can hold many channelId=url entries at once, each
        // switched to on every channel change - only prompt once per domain
        // per session instead of re-asking on every single switch to that
        // channel.
        if (checkedDomains.has(host)) return false;
        checkedDomains.add(host);

        toast(`ChannelWallpaper: asking Discord for permission to load images from ${host} - look for a popup window (it may be behind Discord).`, Toasts.Type.MESSAGE);

        const res = await VencordNative.csp.requestAddOverride(url, ["img-src"], "ChannelWallpaper");

        if (res === "ok") {
            toast("ChannelWallpaper: permission granted! Fully close and reopen Discord for the wallpaper to show up.", Toasts.Type.SUCCESS);
        } else if (res === "cancelled") {
            toast("ChannelWallpaper: permission popup was cancelled/dismissed, so the wallpaper can't load.", Toasts.Type.FAILURE);
        } else if (res === "unchecked") {
            toast("ChannelWallpaper: you need to tick the trust checkbox in the popup before clicking Allow.", Toasts.Type.FAILURE);
        } else if (res === "conflict") {
            toast(`ChannelWallpaper: ${host} already has a different CSP rule set - can't add img-src for it automatically.`, Toasts.Type.FAILURE);
        } else {
            toast(`ChannelWallpaper: permission request failed (${res}).`, Toasts.Type.FAILURE);
        }
        return res === "ok";
    } catch (e) {
        toast(`ChannelWallpaper: CSP check crashed (${(e as Error).message}).`, Toasts.Type.FAILURE);
        return false;
    }
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
    stopNeutralizing();
}

// Discord did a full internal redesign ("Visual Refresh") that replaced the
// old semantic --background-primary/etc. variables this file used to rely on
// with a --neutral-N-hsl scale instead (confirmed by reading ClientTheme's
// own utils/styleUtils.ts, which has to fetch Discord's LIVE stylesheet at
// runtime and regex out --neutral-*-hsl values because there's no longer a
// stable variable name to hardcode) - so overriding the old variables
// silently does nothing now. Rather than guess at whatever Discord's
// variables are named THIS week, this walks the real DOM from body downward
// and force-transparents any actually-opaque element it finds along the
// single "wrapper" trunk (stopping as soon as an element has more than one
// visible child, since that's where real UI structure starts, not a wrapper
// div) - works regardless of what anything is named, versioned or not.
// Re-run via a MutationObserver since Discord's own re-renders can recreate
// these wrapper nodes and drop the inline override. Scoped to whichever
// channel is currently open.
let observer: MutationObserver | null = null;

function neutralizeOpaqueAncestors() {
    let el: Element | null = document.body;
    for (let i = 0; i < 25 && el; i++) {
        if (el !== document.body) {
            const bg = getComputedStyle(el).backgroundColor;
            if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
                (el as HTMLElement).style.setProperty("background-color", "transparent", "important");
                (el as HTMLElement).style.setProperty("background-image", "none", "important");
            }
        }

        const visibleChildren = Array.from(el.children).filter(c => (c as HTMLElement).offsetHeight > 0);
        if (visibleChildren.length !== 1) break;
        el = visibleChildren[0];
    }
}

function startNeutralizing() {
    neutralizeOpaqueAncestors();
    observer?.disconnect();

    let timeout: any;
    observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(neutralizeOpaqueAncestors, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function stopNeutralizing() {
    observer?.disconnect();
    observer = null;
}

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

    startNeutralizing();

    toast("ChannelWallpaper: CSS applied. If you still don't see the image, the URL itself may be broken/blocked - try opening it directly in a browser.", Toasts.Type.SUCCESS);
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
