/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { SelectedChannelStore, UserStore } from "@webpack/common";

interface VoiceState {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
}

const settings = definePluginSettings({
    notifyOnLeave: {
        type: OptionType.BOOLEAN,
        description: "Also notify when someone leaves your current voice channel",
        default: false
    }
});

export default definePlugin({
    name: "VoiceJoinNotify",
    description: "Shows a desktop notification when someone joins (or leaves) the voice channel you're currently in",
    tags: ["VoiceChat", "Notifications"],
    authors: [Devs.HyperCordTeam],
    settings,

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const myChanId = SelectedChannelStore.getVoiceChannelId();
            const myId = UserStore.getCurrentUser().id;
            if (!myChanId) return;

            for (const state of voiceStates) {
                const { userId, channelId, oldChannelId } = state;
                if (userId === myId) continue;

                if (channelId === myChanId && oldChannelId !== myChanId) {
                    const user = UserStore.getUser(userId);
                    showNotification({
                        title: "Voice Channel",
                        body: `${user?.username ?? "Someone"} joined your voice channel`,
                        icon: user?.getAvatarURL?.()
                    });
                } else if (settings.store.notifyOnLeave && oldChannelId === myChanId && channelId !== myChanId) {
                    const user = UserStore.getUser(userId);
                    showNotification({
                        title: "Voice Channel",
                        body: `${user?.username ?? "Someone"} left your voice channel`,
                        icon: user?.getAvatarURL?.()
                    });
                }
            }
        }
    }
});
