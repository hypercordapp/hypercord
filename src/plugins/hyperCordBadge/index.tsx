/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgeUserArgs, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    taggedUsers: {
        type: OptionType.STRING,
        description: "Locally-only custom badges, only visible to you. Format: userId:label,userId2:label2 (e.g. 123456789012345678:Best Friend)",
        default: ""
    }
});

function parseTaggedUsers(): Map<string, string> {
    const map = new Map<string, string>();
    for (const entry of settings.store.taggedUsers.split(",")) {
        const [id, ...labelParts] = entry.split(":");
        const label = labelParts.join(":").trim();
        if (id?.trim() && label) map.set(id.trim(), label);
    }
    return map;
}

const badge: ProfileBadge = {
    id: "HyperCordBadge",
    key: "HyperCordBadge",
    description: "HyperCord custom badge",
    component: ({ userId }: BadgeUserArgs) => {
        const label = parseTaggedUsers().get(userId);
        if (!label) return null;
        return <span style={{ fontSize: 10, marginRight: 2 }} title={label}>✨</span>;
    },
    shouldShow: ({ userId }: BadgeUserArgs) => parseTaggedUsers().has(userId)
};

export default definePlugin({
    name: "HyperCordBadge",
    description: "Adds locally-visible custom profile badges for users you tag yourself (only you see them)",
    tags: ["Appearance"],
    authors: [Devs.HyperCordTeam],
    settings,

    start() {
        addProfileBadge(badge);
    },

    stop() {
        removeProfileBadge(badge);
    }
});
