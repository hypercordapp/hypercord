/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { VoiceState } from "@vencord/discord-types";
import { Toasts, UserStore, VoiceActions, VoiceStateStore } from "@webpack/common";

// Discord is server-authoritative for voice moves - no client can ever truly
// block a moderator moving or disconnecting you, that's enforced server-side
// regardless of what any client does. This can only react: once "armed" on a
// channel, if your voice state ever shows you left it, it immediately rejoins
// you - undoing the move/disconnect a moment later rather than preventing it.
let protectedChannelId: string | null = null;

export default definePlugin({
    name: "AntiMoveDeco",
    description: "Arm your current voice channel so you're automatically rejoined if you get force-moved or disconnected from it - can't truly block a server-side move (nothing can), only undo it immediately after",
    tags: ["Voice", "Utility"],
    authors: [Devs.HyperCordTeam],

    toolboxActions: {
        "Protect Current Voice Channel"() {
            const state = VoiceStateStore.getVoiceStateForUser(UserStore.getCurrentUser()?.id);
            if (!state?.channelId) {
                Toasts.show({ id: Toasts.genId(), message: "You're not in a voice channel.", type: Toasts.Type.FAILURE });
                return;
            }

            protectedChannelId = state.channelId;
            Toasts.show({ id: Toasts.genId(), message: "This voice channel is now protected.", type: Toasts.Type.SUCCESS });
        },
        "Stop Protecting Voice Channel"() {
            protectedChannelId = null;
            Toasts.show({ id: Toasts.genId(), message: "Voice channel protection turned off.", type: Toasts.Type.MESSAGE });
        }
    },

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (!protectedChannelId) return;

            const myId = UserStore.getCurrentUser()?.id;
            const myState = voiceStates.find(s => s.userId === myId);
            if (!myState) return;

            if (myState.channelId !== protectedChannelId) {
                const target = protectedChannelId;
                setTimeout(() => VoiceActions.selectVoiceChannel(target), 300);
            }
        }
    }
});
