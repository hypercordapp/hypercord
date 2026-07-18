/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption } from "@api/Commands";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";

const STYLES = ["t", "T", "d", "D", "f", "F", "R"] as const;

export default definePlugin({
    name: "TimestampMaker",
    description: "Adds a /timestamp command to generate Discord timestamps from a relative offset (in minutes)",
    tags: ["Utility", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "timestamp",
            description: "Generate a Discord timestamp N minutes from now",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "minutes-from-now", description: "Offset in minutes (can be negative for the past)", type: ApplicationCommandOptionType.NUMBER, required: true },
                { name: "style", description: "Timestamp style: t, T, d, D, f, F, R (default R - relative)", type: ApplicationCommandOptionType.STRING, required: false },
            ],
            execute: (args, ctx) => {
                const minutes = findOption<number>(args, "minutes-from-now", 0);
                let style = findOption(args, "style", "R") as string;
                if (!STYLES.includes(style as any)) style = "R";

                const unix = Math.floor(Date.now() / 1000) + Math.round(minutes * 60);
                sendMessage(ctx.channel.id, { content: `<t:${unix}:${style}>` });
            }
        }
    ]
});
