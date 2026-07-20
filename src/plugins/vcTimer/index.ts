/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { SelectedChannelStore, UserStore } from "@webpack/common";

interface VoiceState {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
}

let joinedAt: number | null = null;

function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const parts: string[] = [];
    if (h) parts.push(`${h}h`);
    if (m || h) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
}

export default definePlugin({
    name: "VcTimer",
    description: "Tracks how long you've been connected to your current voice channel. Check with /vctime",
    tags: ["Voice", "Commands"],
    authors: [Devs.HyperCordTeam],

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const myId = UserStore.getCurrentUser()?.id;
            if (!myId) return;

            for (const state of voiceStates) {
                if (state.userId !== myId) continue;

                if (state.channelId && !state.oldChannelId) {
                    joinedAt = Date.now();
                } else if (!state.channelId) {
                    joinedAt = null;
                }
            }
        }
    },

    commands: [
        {
            name: "vctime",
            description: "Show how long you've been in your current voice channel",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_, ctx) => {
                const currentChannel = SelectedChannelStore.getVoiceChannelId();

                if (!currentChannel || !joinedAt) {
                    sendBotMessage(ctx.channel.id, { content: "You're not currently in a voice channel." });
                    return;
                }

                sendBotMessage(ctx.channel.id, { content: `You've been in this voice channel for **${formatDuration(Date.now() - joinedAt)}**.` });
            }
        }
    ]
});
