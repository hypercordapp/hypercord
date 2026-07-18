/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = LOWER.toUpperCase();
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}";

function generatePassword(length: number, useSymbols: boolean): string {
    const pool = LOWER + UPPER + DIGITS + (useSymbols ? SYMBOLS : "");
    const bytes = new Uint32Array(length);
    crypto.getRandomValues(bytes);

    return Array.from(bytes, b => pool[b % pool.length]).join("");
}

export default definePlugin({
    name: "PasswordGenerator",
    description: "Adds a /genpass command to generate a random secure password (sent as an ephemeral message only visible to you)",
    tags: ["Utility", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "genpass",
            description: "Generate a random password",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "length", description: "Password length (default 16)", type: ApplicationCommandOptionType.INTEGER, required: false },
                { name: "symbols", description: "Include symbols (default true)", type: ApplicationCommandOptionType.BOOLEAN, required: false },
            ],
            execute: (args, ctx) => {
                const length = Math.min(128, Math.max(4, findOption(args, "length", 16)));
                const symbols = findOption(args, "symbols", true);

                sendBotMessage(ctx.channel.id, { content: `||${generatePassword(length, symbols)}||` });
            }
        }
    ]
});
