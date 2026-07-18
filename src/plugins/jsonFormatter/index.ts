/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "JsonFormatter",
    description: "Adds a /json command to pretty-print JSON",
    tags: ["Utility", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "json",
            description: "Pretty-print a JSON string",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "json", description: "The JSON string to format", type: ApplicationCommandOptionType.STRING, required: true }
            ],
            execute: (args, ctx) => {
                const raw = findOption(args, "json", "");
                try {
                    const formatted = JSON.stringify(JSON.parse(raw), null, 2);
                    const content = formatted.length > 1900
                        ? "```json\n" + formatted.slice(0, 1900) + "\n... (truncated)\n```"
                        : "```json\n" + formatted + "\n```";
                    sendBotMessage(ctx.channel.id, { content });
                } catch (e) {
                    sendBotMessage(ctx.channel.id, { content: `Invalid JSON: ${String(e)}` });
                }
            }
        }
    ]
});
