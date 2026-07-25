/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Notice } from "@components/Notice";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Channel, User, VoiceState } from "@vencord/discord-types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { Menu, React, VoiceStateStore } from "@webpack/common";

type TFollowedUserInfo = {
    lastChannelId: string | null;
    userId: string;
} | null;

interface UserContextProps {
    channel: Channel;
    user: User;
    guildId?: string;
}

let followedUserInfo: TFollowedUserInfo = null;

const voiceChannelAction = findByPropsLazy("selectVoiceChannel");
const UserStore = findStoreLazy("UserStore");
const RelationshipStore = findStoreLazy("RelationshipStore");

const settings = definePluginSettings({
    onlyWhenInVoice: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Only follow the user when you are in a voice channel"
    },
    leaveWhenUserLeaves: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Leave the voice channel when the user leaves. (That can cause you to sometimes enter infinite leave/join loop)"
    }
});

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { channel, user }: UserContextProps) => {
    if (UserStore.getCurrentUser().id === user.id || !RelationshipStore.getFriendIDs().includes(user.id)) return;

    const [checked, setChecked] = React.useState(followedUserInfo?.userId === user.id);

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuCheckboxItem
            id="fvu-follow-user"
            label="Follow User"
            checked={checked}
            action={() => {
                if (followedUserInfo?.userId === user.id) {
                    followedUserInfo = null;
                    setChecked(false);
                    return;
                }

                // Start tracking from wherever they currently are, not just
                // their next move, and jump there immediately if we can -
                // otherwise "follow" only kicks in once they change channels
                // again, which reads as broken if they're already in voice.
                const currentChannelId = VoiceStateStore.getVoiceStateForUser(user.id)?.channelId ?? null;
                followedUserInfo = {
                    lastChannelId: currentChannelId,
                    userId: user.id
                };
                setChecked(true);

                if (
                    currentChannelId
                    && (!settings.store.onlyWhenInVoice || VoiceStateStore.getVoiceStateForUser(UserStore.getCurrentUser().id))
                ) {
                    voiceChannelAction.selectVoiceChannel(currentChannelId);
                }
            }}
        ></Menu.MenuCheckboxItem>
    );
};

export default definePlugin({
    name: "FollowVoiceUser",
    description: "Follow a friend in voice chat.",
    tags: ["Voice"],
    authors: [EquicordDevs.TheArmagan],
    settings,
    settingsAboutComponent: () => (
        <Notice.Info>
            This Plugin is used to follow a Friend/Friends into voice chat(s).
        </Notice.Info>
    ),
    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (!followedUserInfo) return;
            if (!RelationshipStore.getFriendIDs().includes(followedUserInfo.userId)) return;

            if (
                settings.store.onlyWhenInVoice
                && !VoiceStateStore.getVoiceStateForUser(UserStore.getCurrentUser().id)
            ) return;

            voiceStates.forEach(voiceState => {
                if (voiceState.userId !== followedUserInfo!.userId) return;

                if (voiceState.channelId && voiceState.channelId !== followedUserInfo!.lastChannelId) {
                    followedUserInfo!.lastChannelId = voiceState.channelId;
                    voiceChannelAction.selectVoiceChannel(followedUserInfo!.lastChannelId);
                } else if (!voiceState.channelId) {
                    // Reset instead of leaving stale - otherwise rejoining the exact
                    // same channel they just left wouldn't look like a change and we'd
                    // silently fail to follow them back in.
                    followedUserInfo!.lastChannelId = null;

                    if (settings.store.leaveWhenUserLeaves) {
                        voiceChannelAction.selectVoiceChannel(null);
                    }
                }
            });
        }
    },
    contextMenus: {
        "user-context": UserContextMenuPatch
    }
});
