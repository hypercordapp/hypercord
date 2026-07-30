/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const STYLE_ID = "hypercord-smooth-type";

// Deliberately scoped to what CSS can actually do here: there's no CSS API to
// control the native caret's blink timing/curve directly, so this smooths
// what IS controllable - the caret's color transition, and hints the
// compositor to treat the message composer as its own layer so typing causes
// less visible jank/reflow on lower-end machines.
const CSS = `
[contenteditable="true"] {
    caret-color: var(--text-normal);
    transition: caret-color 0.15s ease;
    will-change: contents;
}
`;

export default definePlugin({
    name: "SmoothType",
    description: "Smooths the message composer's caret color transitions and hints the browser to reduce typing jank",
    tags: ["Appearance"],
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
