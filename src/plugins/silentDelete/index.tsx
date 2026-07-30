/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { Menu, MessageActions, UserStore } from "@webpack/common";

async function silentDelete(message: Message) {
    try {
        // Same editMessage/deleteMessage calls PurgeMessages and SedEnhanced
        // already use elsewhere in this repo - overwrite the content first so
        // any deleted-message logger (yours or anyone else's) only ever sees
        // the placeholder, then actually delete it.
        await MessageActions.editMessage(message.channel_id, message.id, { content: "[deleted]" });
    } catch {
        // still attempt the delete even if the edit failed
    }

    setTimeout(() => {
        MessageActions.deleteMessage(message.channel_id, message.id);
    }, 400);
}

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, { message }: { message: Message; }) => {
    if (!message || message.author?.id !== UserStore.getCurrentUser()?.id) return;

    children.push(
        <Menu.MenuItem
            id="vc-silent-delete"
            label="Silent Delete"
            color="danger"
            action={() => silentDelete(message)}
        />
    );
};

export default definePlugin({
    name: "SilentDelete",
    description: "Adds a 'Silent Delete' option to your own messages - replaces the content with a placeholder right before deleting, so deleted-message loggers don't reveal what it actually said",
    tags: ["Chat"],
    authors: [Devs.HyperCordTeam],

    contextMenus: {
        message: messageContextMenuPatch
    }
});
