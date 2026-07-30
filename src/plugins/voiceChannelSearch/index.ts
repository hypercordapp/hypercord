/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ChannelStore, GuildChannelStore, GuildStore, NavigationRouter } from "@webpack/common";

export default definePlugin({
    name: "VoiceChannelSearch",
    description: "Adds a /findvc command that searches every server you're in for a voice channel by name and jumps straight to it",
    tags: ["Voice", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "findvc",
            description: "Search all your servers for a voice channel by name and jump to it",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "query", description: "Voice channel name to search for", type: ApplicationCommandOptionType.STRING, required: true }
            ],
            execute: (args, ctx) => {
                const query = findOption(args, "query", "").toLowerCase().trim();
                if (!query) return;

                for (const guildId of Object.keys(GuildStore.getGuilds())) {
                    const voiceIds = GuildChannelStore.getVocalChannelIds(guildId) ?? [];

                    const match = voiceIds
                        .map(id => ChannelStore.getChannel(id))
                        .find(channel => channel?.name?.toLowerCase().includes(query));

                    if (match) {
                        NavigationRouter.transitionToGuild(guildId, match.id);
                        return;
                    }
                }

                sendBotMessage(ctx.channel.id, { content: `No voice channel matching "${query}" found in any of your servers.` });
            }
        }
    ]
});
