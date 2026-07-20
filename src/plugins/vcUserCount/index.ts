/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { SelectedChannelStore, UserStore, VoiceStateStore } from "@webpack/common";

export default definePlugin({
    name: "VcUserCount",
    description: "Adds a /vcusers command to list who's currently in your voice channel",
    tags: ["Voice", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "vcusers",
            description: "List the users currently in your voice channel",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_, ctx) => {
                const channelId = SelectedChannelStore.getVoiceChannelId();
                if (!channelId) {
                    sendBotMessage(ctx.channel.id, { content: "You're not currently in a voice channel." });
                    return;
                }

                const states = VoiceStateStore.getVoiceStatesForChannel(channelId) as Record<string, { userId: string; }>;
                const userIds = Object.keys(states ?? {});

                const names = userIds.map(id => UserStore.getUser(id)?.username ?? id);
                sendBotMessage(ctx.channel.id, {
                    content: `**${names.length}** user(s) in this voice channel:\n${names.map(n => `• ${n}`).join("\n")}`
                });
            }
        }
    ]
});
