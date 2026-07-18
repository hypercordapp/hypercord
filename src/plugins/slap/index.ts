/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption } from "@api/Commands";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";
import { UserStore } from "@webpack/common";

const ITEMS = [
    "a large trout",
    "a rubber chicken",
    "a wet noodle",
    "the HyperCord changelog",
    "a cast iron skillet",
    "a foam sword",
    "a keyboard",
];

export default definePlugin({
    name: "Slap",
    description: "Adds a /slap command to slap someone around a bit with a random item",
    tags: ["Fun", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "slap",
            description: "Slap a user around a bit",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "user",
                    description: "The user to slap",
                    type: ApplicationCommandOptionType.USER,
                    required: true
                }
            ],
            execute: (args, ctx) => {
                const userId = findOption(args, "user", "");
                const target = userId ? UserStore.getUser(userId) : null;
                const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];

                const content = target
                    ? `*slaps <@${target.id}> around a bit with ${item}*`
                    : "*couldn't find anyone to slap*";

                sendMessage(ctx.channel.id, { content });
            }
        }
    ]
});
