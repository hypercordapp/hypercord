/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Toasts } from "@webpack/common";

const STYLE_ID = "hypercord-live-wallpaper-style";

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
async function checkImageCsp(url: string): Promise<boolean> {
    if (IS_WEB) return true;

    let host: string;
    try {
        host = new URL(url).host;
    } catch {
        toast("LiveWallpaper: that's not a valid URL.", Toasts.Type.FAILURE);
        return false;
    }

    try {
        if (await VencordNative.csp.isDomainAllowed(url, ["img-src"])) {
            return true;
        }

        toast(`LiveWallpaper: asking Discord for permission to load images from ${host} - look for a popup window (it may be behind Discord).`, Toasts.Type.MESSAGE);

        const res = await VencordNative.csp.requestAddOverride(url, ["img-src"], "LiveWallpaper");

        if (res === "ok") {
            toast("LiveWallpaper: permission granted! Fully close and reopen Discord for the wallpaper to show up.", Toasts.Type.SUCCESS);
        } else if (res === "cancelled") {
            toast("LiveWallpaper: permission popup was cancelled/dismissed, so the wallpaper can't load.", Toasts.Type.FAILURE);
        } else if (res === "unchecked") {
            toast("LiveWallpaper: you need to tick the trust checkbox in the popup before clicking Allow.", Toasts.Type.FAILURE);
        } else if (res === "conflict") {
            toast(`LiveWallpaper: ${host} already has a different CSP rule set - can't add img-src for it automatically.`, Toasts.Type.FAILURE);
        } else {
            toast(`LiveWallpaper: permission request failed (${res}).`, Toasts.Type.FAILURE);
        }
        return res === "ok";
    } catch (e) {
        toast(`LiveWallpaper: CSP check crashed (${(e as Error).message}).`, Toasts.Type.FAILURE);
        return false;
    }
}

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

    toast("LiveWallpaper: CSS applied. If you still don't see the image, the URL itself may be broken/blocked - try opening it directly in a browser.", Toasts.Type.SUCCESS);
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
