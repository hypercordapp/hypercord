/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { UserStore } from "@webpack/common";

const STYLE_ID = "hypercord-stream-proof";

interface StreamEvent { streamKey: string; }

// Same real STREAM_CREATE/STREAM_DELETE events StreamerModeOnStream already
// proves fire correctly - reused here for a blur instead of toggling native
// Streamer Mode, since streamer mode alone doesn't hide message content/
// images, only things like notification previews and nearby-friend info.
// Partial-class-match selectors (`[class*=...]`) are the same technique
// BlurNsfw already ships with successfully, just applied to message content/
// image/embed wrappers generally instead of only flagged NSFW attachments.
function setStyle(enabled: boolean) {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

    if (!enabled) {
        style?.remove();
        return;
    }

    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }

    style.textContent = `
        [class*="messageContent"],
        [class*="imageContainer"],
        [class*="embedWrapper"],
        [class*="attachment"] {
            filter: blur(8px);
            transition: filter 0.2s;
        }
        [class*="messageContent"]:hover,
        [class*="imageContainer"]:hover,
        [class*="embedWrapper"]:hover,
        [class*="attachment"]:hover {
            filter: blur(0);
        }
    `;
}

function toggle({ streamKey }: StreamEvent, enabled: boolean) {
    if (!streamKey.endsWith(UserStore.getCurrentUser().id)) return;
    setStyle(enabled);
}

export default definePlugin({
    name: "StreamProof",
    description: "Blurs message text, images, and embeds while you're screen sharing (hover to peek), without hiding your screenshare/voice grid itself",
    tags: ["Privacy", "Voice"],
    authors: [Devs.HyperCordTeam],

    flux: {
        STREAM_CREATE: d => toggle(d, true),
        STREAM_DELETE: d => toggle(d, false)
    },

    stop() {
        document.getElementById(STYLE_ID)?.remove();
    }
});
