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
    name: "RandomNumber",
    description: "Adds a /random command to pick a random number between min and max",
    tags: ["Utility", "Fun", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "random",
            description: "Generate a random number between min and max (inclusive)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "min", description: "Minimum value (default 1)", type: ApplicationCommandOptionType.INTEGER, required: false },
                { name: "max", description: "Maximum value (default 100)", type: ApplicationCommandOptionType.INTEGER, required: false },
            ],
            execute: (args, ctx) => {
                let min = findOption<number>(args, "min", 1);
                let max = findOption<number>(args, "max", 100);
                if (min > max) [min, max] = [max, min];

                const result = min + Math.floor(Math.random() * (max - min + 1));
                sendMessage(ctx.channel.id, { content: `🎯 **${result}** (between ${min} and ${max})` });
            }
        }
    ]
});
