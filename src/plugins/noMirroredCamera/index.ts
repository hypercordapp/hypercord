/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const STYLE_ID = "hypercord-no-mirrored-camera";

const CSS = `
[class*="videoWrapper"] video,
[class*="selfVideo"] video,
[class*="mirror"] video {
    transform: none !important;
}
`;

export default definePlugin({
    name: "NoMirroredCamera",
    description: "Attempts to disable the mirrored preview of your own camera in voice calls (best-effort, CSS-only, cannot conflict with Discord's own rendering)",
    tags: ["Voice", "Appearance"],
    authors: [Devs.HyperCordTeam],

    start() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = CSS;
        document.head.appendChild(style);
    },

    stop() {
        document.getElementById(STYLE_ID)?.remove();
    }
});
