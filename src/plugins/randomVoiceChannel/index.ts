/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, GuildChannelStore, SelectedGuildStore } from "@webpack/common";

const VoiceActions = findByPropsLazy("selectVoiceChannel", "selectChannel");

export default definePlugin({
    name: "RandomVoiceChannel",
    description: "Adds a /randomvc command that joins a random voice channel in the current server",
    tags: ["Voice", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "randomvc",
            description: "Join a random voice channel in this server",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_, ctx) => {
                const guildId = SelectedGuildStore.getGuildId();
                if (!guildId) {
                    sendBotMessage(ctx.channel.id, { content: "You must be in a server to use this command." });
                    return;
                }

                const voiceChannelIds = GuildChannelStore.getVocalChannelIds(guildId) ?? [];

                if (!voiceChannelIds.length) {
                    sendBotMessage(ctx.channel.id, { content: "No voice channels found in this server." });
                    return;
                }

                const targetId = voiceChannelIds[Math.floor(Math.random() * voiceChannelIds.length)];
                const target = ChannelStore.getChannel(targetId);
                VoiceActions.selectVoiceChannel(targetId);

                sendBotMessage(ctx.channel.id, { content: `Joining **${target?.name ?? "a random channel"}**...` });
            }
        }
    ]
});
