/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ChannelStore, SelectedChannelStore, UserStore } from "@webpack/common";

interface VoiceState {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
}

interface LogEntry {
    time: number;
    userId: string;
    type: "join" | "leave";
    channelId: string;
}

const MAX_ENTRIES = 50;
const log: LogEntry[] = [];

export default definePlugin({
    name: "VoiceActivityLog",
    description: "Keeps a local log of voice channel joins/leaves you witness. View it with /vclog",
    tags: ["VoiceChat", "Utility"],
    authors: [Devs.HyperCordTeam],

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const myChanId = SelectedChannelStore.getVoiceChannelId();
            if (!myChanId) return;

            for (const state of voiceStates) {
                const { userId, channelId, oldChannelId } = state;

                if (channelId === myChanId && oldChannelId !== myChanId) {
                    log.push({ time: Date.now(), userId, type: "join", channelId });
                } else if (oldChannelId === myChanId && channelId !== myChanId) {
                    log.push({ time: Date.now(), userId, type: "leave", channelId: oldChannelId! });
                }

                if (log.length > MAX_ENTRIES) log.shift();
            }
        }
    },

    commands: [
        {
            name: "vclog",
            description: "Show the recent voice channel activity log",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_, ctx) => {
                if (!log.length) {
                    sendBotMessage(ctx.channel.id, { content: "No voice activity recorded yet." });
                    return;
                }

                const lines = log.slice(-15).reverse().map(entry => {
                    const user = UserStore.getUser(entry.userId);
                    const channel = ChannelStore.getChannel(entry.channelId);
                    const emoji = entry.type === "join" ? "🟢" : "🔴";
                    return `${emoji} **${user?.username ?? entry.userId}** ${entry.type === "join" ? "joined" : "left"} **${channel?.name ?? "a channel"}** · <t:${Math.floor(entry.time / 1000)}:R>`;
                });

                sendBotMessage(ctx.channel.id, { content: lines.join("\n") });
            }
        }
    ]
});
