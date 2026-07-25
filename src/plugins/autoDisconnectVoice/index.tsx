/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Notice } from "@components/Notice";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Channel, User, VoiceState } from "@vencord/discord-types";
import { ChannelStore, Menu, PermissionsBits, PermissionStore, React, RestAPI, UserStore } from "@webpack/common";

interface UserContextProps {
    channel: Channel;
    user: User;
    guildId?: string;
}

// Session-only, same as FollowVoiceUser's followedUserInfo - re-pick your
// targets from the user context menu after a reload rather than having them
// silently keep acting on someone from a past session.
const targetUserIds = new Set<string>();

function kickFromVoice(channel: Channel, userId: string) {
    RestAPI.patch({
        url: `/guilds/${channel.guild_id}/members/${userId}`,
        body: { channel_id: null }
    }).catch(e => {
        console.error("AutoDisconnectVoice failed to disconnect", userId, e);
    });
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => {
    if (!user || UserStore.getCurrentUser().id === user.id) return;

    const [checked, setChecked] = React.useState(targetUserIds.has(user.id));

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuCheckboxItem
            id="adv-auto-disconnect-user"
            label="Auto Disconnect From Voice"
            checked={checked}
            action={() => {
                if (targetUserIds.has(user.id)) {
                    targetUserIds.delete(user.id);
                    setChecked(false);
                } else {
                    targetUserIds.add(user.id);
                    setChecked(true);
                }
            }}
        />
    );
};

export default definePlugin({
    name: "AutoDisconnectVoice",
    description: "Instantly disconnects chosen users from voice the moment they join a channel you can move members in.",
    tags: ["Voice", "Organisation"],
    authors: [Devs.HyperCordTeam],
    settingsAboutComponent: () => (
        <Notice.Info>
            Pick targets from a user's right-click context menu ("Auto Disconnect From Voice"). Only works
            in servers where you have the Move Members permission - Discord doesn't allow disconnecting
            someone otherwise. Targets reset when the client reloads.
        </Notice.Info>
    ),
    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (targetUserIds.size === 0) return;

            for (const voiceState of voiceStates) {
                if (!voiceState.channelId || !targetUserIds.has(voiceState.userId)) continue;

                const channel = ChannelStore.getChannel(voiceState.channelId);
                if (!channel?.guild_id) continue;
                if (!PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel)) continue;

                kickFromVoice(channel, voiceState.userId);
            }
        }
    },
    contextMenus: {
        "user-context": UserContextMenuPatch
    },
    stop() {
        targetUserIds.clear();
    }
});
