/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { Menu } from "@webpack/common";

interface MessageContextProps {
    message: Message;
}

const MessageContextMenuPatch: NavContextMenuPatchCallback = (children, { message }: MessageContextProps) => {
    if (!message?.content) return;

    children.push(
        <Menu.MenuItem
            id="vc-quick-google"
            label="Google This"
            action={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(message.content)}`, "_blank")}
        />
    );
};

export default definePlugin({
    name: "QuickGoogle",
    description: "Adds a 'Google This' option to the message context menu to quickly search a message's content",
    tags: ["Utility"],
    authors: [Devs.HyperCordTeam],

    contextMenus: {
        "message": MessageContextMenuPatch
    }
});
