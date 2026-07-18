/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

type ConvertFn = (v: number) => number;

const UNITS: Record<string, Record<string, ConvertFn>> = {
    km: { mi: v => v * 0.621371, m: v => v * 1000, ft: v => v * 3280.84 },
    mi: { km: v => v * 1.60934, m: v => v * 1609.34, ft: v => v * 5280 },
    m: { km: v => v / 1000, mi: v => v / 1609.34, ft: v => v * 3.28084, cm: v => v * 100 },
    ft: { m: v => v / 3.28084, km: v => v / 3280.84, mi: v => v / 5280, cm: v => v * 30.48 },
    cm: { m: v => v / 100, ft: v => v / 30.48, "in": v => v / 2.54 },
    "in": { cm: v => v * 2.54, ft: v => v / 12 },
    kg: { lb: v => v * 2.20462, g: v => v * 1000 },
    lb: { kg: v => v / 2.20462, g: v => v * 453.592 },
    g: { kg: v => v / 1000, lb: v => v / 453.592 },
    c: { f: v => (v * 9) / 5 + 32, k: v => v + 273.15 },
    f: { c: v => ((v - 32) * 5) / 9, k: v => ((v - 32) * 5) / 9 + 273.15 },
    k: { c: v => v - 273.15, f: v => ((v - 273.15) * 9) / 5 + 32 },
};

export default definePlugin({
    name: "UnitConverter",
    description: "Adds a /convert command to convert between common units (length, weight, temperature)",
    tags: ["Utility", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "convert",
            description: "Convert a value between units, e.g. /convert 10 km mi",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "value", description: "The numeric value to convert", type: ApplicationCommandOptionType.NUMBER, required: true },
                { name: "from", description: "Unit to convert from (km, mi, m, ft, cm, in, kg, lb, g, c, f, k)", type: ApplicationCommandOptionType.STRING, required: true },
                { name: "to", description: "Unit to convert to", type: ApplicationCommandOptionType.STRING, required: true },
            ],
            execute: (args, ctx) => {
                const value = findOption<number>(args, "value", 0);
                const from = findOption(args, "from", "").toLowerCase();
                const to = findOption(args, "to", "").toLowerCase();

                const table = UNITS[from];
                const fn = table?.[to];

                if (!fn) {
                    sendBotMessage(ctx.channel.id, { content: `Could not convert from \`${from}\` to \`${to}\`. Supported units: km, mi, m, ft, cm, in, kg, lb, g, c, f, k.` });
                    return;
                }

                const result = fn(value);
                sendBotMessage(ctx.channel.id, { content: `${value} ${from} = ${Math.round(result * 10000) / 10000} ${to}` });
            }
        }
    ]
});
