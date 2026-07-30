/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const STYLE_ID = "hypercord-stealth-mode";

// Every chat-bar button any plugin adds goes through the same required
// ChatInputButtonAPI, which always tags its wrapper with this exact class
// (see src/api/ChatButtons.tsx) - hiding it here doesn't touch any Discord
// class, only ours, so every plugin's button disappears without disabling
// the plugin itself.
const CSS = `
.vc-chatbar-button {
    display: none !important;
}
`;

export default definePlugin({
    name: "StealthMode",
    description: "Hides every chat-bar button added by any plugin, without disabling the plugins themselves",
    tags: ["Utility"],
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
