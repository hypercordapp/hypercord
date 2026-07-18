/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const STYLE_ID = "hypercord-no-nitro-upsell";

const CSS = `
[class*="nitroFeatureCard"],
[class*="premiumBadge"],
[class*="premiumPromotion"],
[class*="nitroUpsell"],
[class*="upsellSidebar"],
a[href^="/store"],
[href*="premium-marketing"] {
    display: none !important;
}
`;

export default definePlugin({
    name: "NoNitroUpsell",
    description: "Hides Nitro upsell banners, badges, and promotional buttons around the client (best-effort)",
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
