/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    triggerWord: {
        type: OptionType.STRING,
        description: "Word that triggers the jumpscare when someone says it (case-insensitive)",
        default: "boo"
    },
    imageUrl: {
        type: OptionType.STRING,
        description: "Image URL to flash on screen",
        default: "https://raw.githubusercontent.com/VenPlugs/petpet/main/frames/pet5.gif"
    },
    duration: {
        type: OptionType.SLIDER,
        description: "How long the jumpscare stays on screen (ms)",
        markers: [200, 400, 600, 800, 1200],
        default: 500,
        stickToMarkers: false
    }
});

let overlay: HTMLDivElement | null = null;

function showJumpscare() {
    if (overlay) return;

    overlay = document.createElement("div");
    Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "9999999",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "black",
        pointerEvents: "none"
    } satisfies Partial<CSSStyleDeclaration>);

    const img = document.createElement("img");
    img.src = settings.store.imageUrl;
    Object.assign(img.style, {
        maxWidth: "100%",
        maxHeight: "100%"
    } satisfies Partial<CSSStyleDeclaration>);

    overlay.appendChild(img);
    document.body.appendChild(overlay);

    setTimeout(() => {
        overlay?.remove();
        overlay = null;
    }, settings.store.duration);
}

function onMessageCreate({ message }: any) {
    try {
        if (!message?.content) return;
        if (message.author?.id === UserStore.getCurrentUser()?.id) return;

        const trigger = settings.store.triggerWord.trim().toLowerCase();
        if (!trigger) return;

        if (message.content.toLowerCase().includes(trigger)) {
            showJumpscare();
        }
    } catch { }
}

export default definePlugin({
    name: "Jumpscare",
    description: "Flashes a scary image on screen when someone says a trigger word",
    tags: ["Fun"],
    authors: [Devs.HyperCordTeam],
    settings,

    start() {
        FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
    },

    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
        overlay?.remove();
        overlay = null;
    }
});
