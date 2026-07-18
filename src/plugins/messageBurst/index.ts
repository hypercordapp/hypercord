/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "MessageBurst",
    description: "Adds a /burst command to send the same message multiple times with a delay",
    tags: ["Chat", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "burst",
            description: "Send a message multiple times",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "message", description: "The message to send", type: ApplicationCommandOptionType.STRING, required: true },
                { name: "count", description: "How many times to send it (max 10)", type: ApplicationCommandOptionType.INTEGER, required: true },
                { name: "delay-ms", description: "Delay between messages in ms (default 750, min 250)", type: ApplicationCommandOptionType.INTEGER, required: false },
            ],
            execute: async (args, ctx) => {
                const message = findOption(args, "message", "");
                const count = Math.min(10, Math.max(1, findOption(args, "count", 1)));
                const delay = Math.max(250, findOption(args, "delay-ms", 750));

                if (!message) {
                    sendBotMessage(ctx.channel.id, { content: "You must provide a message to burst." });
                    return;
                }

                for (let i = 0; i < count; i++) {
                    sendMessage(ctx.channel.id, { content: message });
                    if (i < count - 1) await new Promise(r => setTimeout(r, delay));
                }
            }
        }
    ]
});
