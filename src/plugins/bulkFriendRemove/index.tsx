/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ConfirmModal, openModal, RelationshipStore } from "@webpack/common";

// Same module CancelFriendRequest (folder pendingFriendRequest) already uses
// for cancelFriendRequest/addRelationship - Discord's real relationship
// action creators are conventionally bundled together, so removeRelationship
// lives on this same already-proven module.
const RelationshipActions = findByPropsLazy("cancelFriendRequest", "addRelationship");

async function removeAllFriends(channelId: string) {
    const ids = RelationshipStore.getFriendIDs();
    let removed = 0;

    for (const id of ids) {
        try {
            await RelationshipActions.removeRelationship(id);
            removed++;
        } catch {
            // keep going
        }
        await new Promise(r => setTimeout(r, 400));
    }

    sendBotMessage(channelId, { content: `Removed ${removed}/${ids.length} friend(s).` });
}

export default definePlugin({
    name: "BulkFriendRemove",
    description: "Adds a /removeallfriends command to remove every friend on your list at once - asks for confirmation first, they'd need to send a new request to be added back",
    tags: ["Utility", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "removeallfriends",
            description: "Remove every friend on your friends list (asks for confirmation first)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_args, ctx) => {
                const count = RelationshipStore.getFriendIDs().length;

                openModal(props => (
                    <ConfirmModal
                        {...props}
                        title="Remove every friend?"
                        subtitle={`This will remove all ${count} friend(s) on your list. They'd have to send a new friend request to be added back.`}
                        confirmText="Remove all"
                        cancelText="Cancel"
                        onConfirm={() => removeAllFriends(ctx.channel.id)}
                    />
                ));
            }
        }
    ]
});
