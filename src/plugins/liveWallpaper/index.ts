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
// scale (confirmed via ClientTheme's own styleUtils.ts). Two follow-up
// attempts after that discovery (a single-trunk DOM walk stopping at the
// first branch, then blindly nulling every #app-mount descendant's
// background-color) still weren't enough for the image itself - the
// transparency fix (`#app-mount *` background-color nulling) was always
// correct and IS what's applied here, confirmed by live-testing with
// DevTools attached via CDP: a plain solid background-color on html/body
// renders correctly through every panel once descendants are transparent.
// A `background-image` (any of: body, a real `<img>` element behind
// everything, or even Discord's own dedicated `[class*="bg__"]` layer div)
// does NOT - Discord's redesigned chrome (guild rail, channel sidebar,
// member list, header) never composites a custom background image sitting
// behind it, no matter which element holds it, confirmed identical across
// 8+ live variations including a real OS-level window resize (rules out a
// stale GPU raster-tile cache). The ONE region that reliably composites a
// background image is the message content area itself
// (`[class*="chatContent_"]`) - not a CSS mistake, an actual rendering
// constraint of this Discord build. So: the real wallpaper image goes on a
// ::before behind the chat content specifically (a pseudo-element, not the
// element's own background), and the rest of the chrome gets a solid,
// matching tint on #app-mount itself instead of trying to show the literal
// image there - a real, working "glass over a wallpaper" look rather than
// the previous "make everything transparent and hope" that only ever
// half-worked.
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
        #app-mount {
            background-color: rgba(0, 0, 0, ${alpha}) !important;
        }
        #app-mount * {
            background-color: transparent !important;
        }
        [class*="chatContent_"] {
            position: relative !important;
        }
        [class*="chatContent_"]::before {
            content: "";
            position: absolute;
            inset: 0;
            z-index: -1;
            pointer-events: none;
            background-image:
                linear-gradient(rgba(0, 0, 0, ${alpha}), rgba(0, 0, 0, ${alpha})),
                url("${settings.store.imageUrl}");
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
        }
    `;

    toast("LiveWallpaper: applied. The wallpaper shows behind the main chat area (the one region Discord's own renderer reliably composites a custom background image behind), with the rest of the UI tinted to match. If you still don't see anything, the image itself is the problem - open the URL directly in a browser to confirm it loads.", Toasts.Type.SUCCESS);
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
