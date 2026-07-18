/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType } from "@api/Commands";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "CoinFlip",
    description: "Adds a /coinflip command",
    tags: ["Utility", "Fun", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "coinflip",
            description: "Flip a coin",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_, ctx) => {
                const result = Math.random() < 0.5 ? "Heads" : "Tails";
                sendMessage(ctx.channel.id, { content: `🪙 **${result}**` });
            }
        }
    ]
});
