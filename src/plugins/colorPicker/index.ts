/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

function parseColor(input: string): { r: number; g: number; b: number; } | null {
    let hex = input.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(hex)) hex = hex.split("").map(c => c + c).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;

    return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
    };
}

function rgbToHsl(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export default definePlugin({
    name: "ColorPicker",
    description: "Adds a /color command that shows hex, rgb and hsl values for a given hex color",
    tags: ["Utility", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "color",
            description: "Show info about a hex color, e.g. /color #5865F2",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "hex", description: "Hex color code, e.g. #5865F2 or 5865F2", type: ApplicationCommandOptionType.STRING, required: true }
            ],
            execute: (args, ctx) => {
                const hex = findOption(args, "hex", "");
                const rgb = parseColor(hex);
                if (!rgb) {
                    sendBotMessage(ctx.channel.id, { content: `\`${hex}\` is not a valid hex color.` });
                    return;
                }
                const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
                sendBotMessage(ctx.channel.id, {
                    content: `**#${hex.replace("#", "").toUpperCase()}**\nRGB: \`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})\`\nHSL: \`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)\``
                });
            }
        }
    ]
});
