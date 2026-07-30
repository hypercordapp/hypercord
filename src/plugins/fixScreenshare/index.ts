/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Toasts, UserStore, VoiceActions, VoiceStateStore } from "@webpack/common";

// Best-effort generic fix: a full leave-and-rejoin of the current voice
// channel, which is the standard manual workaround for a screenshare stuck
// on "infinite loading" - this automates that workaround as one click rather
// than reproducing the exact underlying bug (not something verifiable
// without the specific crash to reproduce it against).
export default definePlugin({
    name: "FixScreenshare",
    description: "Adds a toolbox action that leaves and immediately rejoins your current voice channel, the standard manual fix for a screenshare stuck loading forever",
    tags: ["Voice", "Utility"],
    authors: [Devs.HyperCordTeam],

    toolboxActions: {
        "Reset Voice Connection"() {
            const state = VoiceStateStore.getVoiceStateForUser(UserStore.getCurrentUser()?.id);
            const channelId = state?.channelId;

            if (!channelId) {
                Toasts.show({ id: Toasts.genId(), message: "You're not in a voice channel.", type: Toasts.Type.FAILURE });
                return;
            }

            VoiceActions.selectVoiceChannel(null);
            setTimeout(() => VoiceActions.selectVoiceChannel(channelId), 800);

            Toasts.show({ id: Toasts.genId(), message: "Reconnecting to voice…", type: Toasts.Type.MESSAGE });
        }
    }
});
