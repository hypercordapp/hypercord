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
    name: "QRCodeGenerator",
    description: "Adds a /qrcode command that generates and sends a QR code image for the given text",
    tags: ["Utility", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "qrcode",
            description: "Generate a QR code for some text or a URL",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "text", description: "Text or URL to encode", type: ApplicationCommandOptionType.STRING, required: true }
            ],
            execute: (args, ctx) => {
                const text = findOption(args, "text", "");
                const url = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(text)}`;
                sendMessage(ctx.channel.id, { content: url });
            }
        }
    ]
});
