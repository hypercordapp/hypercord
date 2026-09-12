/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { saveFile } from "@utils/web";
import type { User } from "@vencord/discord-types";
import { IconUtils, Menu, Toasts } from "@webpack/common";

interface UserContextProps {
    user?: User;
}

async function downloadAvatar(user: User) {
    const url = IconUtils.getUserAvatarURL(user, true, 1024).replace(/\?size=\d+$/, "?size=1024");

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const blob = await res.blob();
        const ext = blob.type.split("/")[1]?.split("+")[0] || "png";
        saveFile(new File([blob], `${user.username}_avatar.${ext}`, { type: blob.type }));
        Toasts.show({
            id: Toasts.genId(),
            type: Toasts.Type.SUCCESS,
            message: "Avatar saved successfully!"
        });
    } catch (e) {
        console.error("[SaveAvatar] Failed to download avatar", e);
        Toasts.show({
            id: Toasts.genId(),
            type: Toasts.Type.FAILURE,
            message: "Failed to download avatar"
        });
    }
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: UserContextProps = {}) => {
    if (!user?.id) return;

    children.splice(-1, 0, (
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="vc-save-avatar"
                label="Save Avatar"
                action={() => downloadAvatar(user)}
            />
        </Menu.MenuGroup>
    ));
};

export default definePlugin({
    name: "SaveAvatar",
    description: "Adds a 'Save Avatar' option to the user context menu to download a user's avatar",
    tags: ["Utility"],
    authors: [Devs.HyperCordTeam],

    contextMenus: {
        "user-context": UserContextMenuPatch,
        "user-profile-actions": UserContextMenuPatch
    }
});
