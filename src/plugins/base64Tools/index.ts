/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "Base64Tools",
    description: "Adds /base64encode and /base64decode commands",
    tags: ["Utility", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "base64encode",
            description: "Encode text to Base64",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "text", description: "Text to encode", type: ApplicationCommandOptionType.STRING, required: true }
            ],
            execute: (args, ctx) => {
                const text = findOption(args, "text", "");
                try {
                    sendBotMessage(ctx.channel.id, { content: btoa(unescape(encodeURIComponent(text))) });
                } catch {
                    sendBotMessage(ctx.channel.id, { content: "Failed to encode text." });
                }
            }
        },
        {
            name: "base64decode",
            description: "Decode Base64 to text",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "text", description: "Base64 to decode", type: ApplicationCommandOptionType.STRING, required: true }
            ],
            execute: (args, ctx) => {
                const text = findOption(args, "text", "");
                try {
                    sendBotMessage(ctx.channel.id, { content: decodeURIComponent(escape(atob(text))) });
                } catch {
                    sendBotMessage(ctx.channel.id, { content: "Invalid Base64 string." });
                }
            }
        }
    ]
});
