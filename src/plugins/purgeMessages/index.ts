/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { MessageActions, MessageStore, UserStore } from "@webpack/common";

export default definePlugin({
    name: "PurgeMessages",
    description: "Adds a /purge command to bulk-delete your own recent messages in the current channel",
    tags: ["Chat", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "purge",
            description: "Delete your own last N messages in this channel",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "count", description: "How many of your own messages to delete (max 50)", type: ApplicationCommandOptionType.INTEGER, required: true }
            ],
            execute: async (args, ctx) => {
                const count = Math.min(50, Math.max(1, findOption(args, "count", 1)));
                const self = UserStore.getCurrentUser();

                const all = (MessageStore.getMessages(ctx.channel.id) as any)?._array ?? [];
                const own = all.filter((m: any) => m.author?.id === self?.id).slice(-count);

                for (const msg of own) {
                    MessageActions.deleteMessage(ctx.channel.id, msg.id);
                    await new Promise(r => setTimeout(r, 300));
                }

                sendBotMessage(ctx.channel.id, { content: `Deleted ${own.length} message(s).` });
            }
        }
    ]
});
