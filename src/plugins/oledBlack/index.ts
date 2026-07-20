/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const STYLE_ID = "hypercord-oled-black";

const CSS = `
:root {
    --background-primary: #000000 !important;
    --background-secondary: #000000 !important;
    --background-secondary-alt: #050505 !important;
    --background-tertiary: #000000 !important;
    --background-floating: #050505 !important;
    --background-mobile-primary: #000000 !important;
    --background-mobile-secondary: #000000 !important;
    --channeltextarea-background: #050505 !important;
}
`;

export default definePlugin({
    name: "OledBlack",
    description: "Forces pure black (#000000) backgrounds for a true OLED dark theme",
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
