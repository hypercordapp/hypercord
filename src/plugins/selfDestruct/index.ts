/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Constants, MessageActions, RestAPI, SnowflakeUtils } from "@webpack/common";

export default definePlugin({
    name: "SelfDestruct",
    description: "Adds a /selfdestruct command that sends a message and automatically deletes it after a countdown",
    tags: ["Chat", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "selfdestruct",
            description: "Send a message that deletes itself after N seconds",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "message", description: "The message to send", type: ApplicationCommandOptionType.STRING, required: true },
                { name: "seconds", description: "Seconds until it self-destructs (1-300, default 10)", type: ApplicationCommandOptionType.INTEGER, required: false }
            ],
            execute: async (args, ctx) => {
                const content = findOption(args, "message", "");
                const seconds = Math.min(300, Math.max(1, findOption(args, "seconds", 10)));
                if (!content) return;

                // Sent as a genuinely normal message (same REST call every real
                // client message goes through) - the "self-destruct" part is
                // just a local setTimeout deleting it afterward, nothing
                // server-side or ephemeral about it in between.
                const res = await RestAPI.post({
                    url: Constants.Endpoints.MESSAGES(ctx.channel.id),
                    body: { content, nonce: SnowflakeUtils.fromTimestamp(Date.now()) }
                });

                const messageId = res?.body?.id;
                if (!messageId) {
                    sendBotMessage(ctx.channel.id, { content: "Failed to send the message." });
                    return;
                }

                setTimeout(() => {
                    MessageActions.deleteMessage(ctx.channel.id, messageId);
                }, seconds * 1000);
            }
        }
    ]
});
