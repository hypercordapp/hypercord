/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import type { Channel, Guild, User } from "@vencord/discord-types";
import { findByCodeLazy } from "@webpack";
import { ChannelStore, Menu, Modal, openModal, PermissionsBits, SelectedChannelStore, SelectedGuildStore } from "@webpack/common";

// Same generic (works for ANY user, not just yourself) permission computer
// MoreUserTags already relies on - PermissionStore.computePermissions only
// ever computes for the CURRENT user, this is the real underlying function
// that takes an arbitrary user.
const computePermissions: (options: {
    user?: { id: string; } | string | null;
    context?: Guild | Channel | null;
    overwrites?: Channel["permissionOverwrites"] | null;
}) => bigint = findByCodeLazy(".getCurrentUser()", ".computeLurkerPermissionsAllowList()");

function openPermsModal(user: User) {
    const channelId = SelectedChannelStore.getChannelId();
    const channel = channelId ? ChannelStore.getChannel(channelId) : null;
    if (!channel) return;

    const permissions = computePermissions({ user, context: channel, overwrites: channel.permissionOverwrites });
    const granted = Object.entries(PermissionsBits)
        .filter(([, bit]) => (permissions & (bit as unknown as bigint)) === (bit as unknown as bigint))
        .map(([name]) => name);

    openModal(props => (
        <Modal
            {...props}
            size="md"
            title={`${user.username}'s Permissions Here`}
            actions={[{ text: "Close", variant: "secondary", onClick: props.onClose }]}
        >
            <div style={{ padding: "16px", maxHeight: 400, overflowY: "auto" }}>
                {granted.length
                    ? granted.map(name => <div key={name}>{name}</div>)
                    : <div>No permissions in this channel.</div>}
            </div>
        </Modal>
    ));
}

const userContextPatch: NavContextMenuPatchCallback = (children, { user }: { user?: User; }) => {
    if (!user || !SelectedGuildStore.getGuildId()) return;

    children.push(
        <Menu.MenuItem
            id="vc-share-perms"
            label="View Permissions Here"
            action={() => openPermsModal(user)}
        />
    );
};

export default definePlugin({
    name: "SharePerms",
    description: "Adds a 'View Permissions Here' option to the user context menu, showing exactly which permissions that user has in the current channel",
    tags: ["Utility"],
    authors: [Devs.HyperCordTeam],

    contextMenus: {
        "user-context": userContextPatch
    }
});
