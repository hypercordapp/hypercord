/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption } from "@api/Commands";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "DiceRoller",
    description: "Adds a /roll command to roll dice using NdM notation (e.g. 2d6)",
    tags: ["Utility", "Fun", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "roll",
            description: "Roll dice, e.g. 2d6 or 1d20",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "dice", description: "Dice notation, e.g. 2d6 (default 1d6)", type: ApplicationCommandOptionType.STRING, required: false }
            ],
            execute: (args, ctx) => {
                const notation = findOption(args, "dice", "1d6");
                const match = /^(\d{1,2})d(\d{1,4})$/i.exec(notation.trim());

                if (!match) {
                    sendMessage(ctx.channel.id, { content: `Invalid dice notation \`${notation}\`. Use format like \`2d6\`.` });
                    return;
                }

                const count = Math.min(20, parseInt(match[1], 10));
                const sides = Math.min(1000, parseInt(match[2], 10));

                const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
                const total = rolls.reduce((a, b) => a + b, 0);

                sendMessage(ctx.channel.id, {
                    content: `🎲 Rolled \`${notation}\`: [${rolls.join(", ")}] = **${total}**`
                });
            }
        }
    ]
});
