/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import type { User } from "@vencord/discord-types";
import { Menu, Toasts } from "@webpack/common";

interface UserContextProps {
    user: User;
}

// Never calls any real Discord API - purely a local toast, so the "target"
// user is never actually affected in any way, on any server, for anyone else.
// It's a joke UI element for your own screen only.
function fakeAction(user: User, action: string) {
    Toasts.show({
        id: Toasts.genId(),
        message: `${user.username} has been ${action} (not real - only you see this)`,
        type: Toasts.Type.MESSAGE
    });
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => {
    if (!user) return;

    children.push(
        <Menu.MenuGroup label="Fake Mod Actions">
            <Menu.MenuItem id="vc-fakeperm-kick" label="Kick" action={() => fakeAction(user, "kicked")} />
            <Menu.MenuItem id="vc-fakeperm-ban" label="Ban" action={() => fakeAction(user, "banned")} />
            <Menu.MenuItem id="vc-fakeperm-timeout" label="Timeout (1h)" action={() => fakeAction(user, "timed out")} />
        </Menu.MenuGroup>
    );
};

export default definePlugin({
    name: "FakePerm",
    description: "Adds fake Kick/Ban/Timeout options to the user context menu for a laugh - purely local, never sends anything to Discord or affects the actual user",
    tags: ["Fun"],
    authors: [Devs.HyperCordTeam],

    contextMenus: {
        "user-context": UserContextMenuPatch
    }
});
