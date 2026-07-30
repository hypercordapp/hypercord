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

// Discord did a full internal redesign ("Visual Refresh") that replaced the
// old semantic --background-primary/etc. variables with a --neutral-N-hsl
// scale (confirmed via ClientTheme's own styleUtils.ts). A follow-up single-
// trunk DOM walk (stopping at the first branch) still wasn't enough - the
// real visible panels (sidebar/chat/member list) sit AT that branch point as
// siblings, each painting its own opaque background, so a walk that stops
// there never actually reaches them.
//
// This is the blunt-but-guaranteed fix: `#app-mount *` unconditionally nulls
// out EVERY descendant's background-color, no name/depth/branch guessing at
// all. The dim effect can no longer come from recoloring those backgrounds
// (nothing left to recolor), so it's baked directly into body's own
// background-image instead, as a second CSS layer (a solid-color gradient)
// stacked on top of the photo in the same background-image value.
//
// Tradeoff, told to the user directly: this can visually flatten some small
// UI elements that leaned on their own background color for contrast (badges,
// some buttons, code blocks) - worth it to actually see the wallpaper first.
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

    style.textContent = `
        html, body {
            background-image:
                linear-gradient(rgba(0, 0, 0, ${alpha}), rgba(0, 0, 0, ${alpha})),
                url("${settings.store.imageUrl}") !important;
            background-size: cover !important;
            background-position: center !important;
            background-attachment: fixed !important;
            background-repeat: no-repeat !important;
        }
        #app-mount, #app-mount * {
            background-color: transparent !important;
        }
    `;

    toast("LiveWallpaper: CSS applied (aggressive mode - every panel background inside Discord is now forced transparent). If you STILL don't see anything, the image itself is the problem - open the URL directly in a browser to confirm it actually loads.", Toasts.Type.SUCCESS);
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
