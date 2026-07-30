/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, GuildMemberStore, RestAPI, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    lockedNicknames: {
        type: OptionType.STRING,
        description: "One guildId=nickname pair per line - leave the nickname empty (guildId=) to lock to no nickname at all",
        default: "",
        multiline: true
    }
});

function parseLocks(): Map<string, string> {
    const map = new Map<string, string>();
    for (const line of settings.store.lockedNicknames.split("\n")) {
        const idx = line.indexOf("=");
        if (idx === -1) continue;
        map.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
    }
    return map;
}

// Uses Discord's own documented "Modify Current Member" REST endpoint
// directly (PATCH /guilds/{id}/members/@me, {nick}) rather than guessing at
// an internal action-creator name for this one.
function checkGuild(guildId: string) {
    const desired = parseLocks().get(guildId);
    if (desired === undefined) return;

    const userId = UserStore.getCurrentUser()?.id;
    if (!userId) return;

    const member = GuildMemberStore.getMember(guildId, userId);
    const current = member?.nick ?? "";

    if (current === desired) return;

    RestAPI.patch({
        url: `/guilds/${guildId}/members/@me`,
        body: { nick: desired || null }
    }).catch(() => {});
}

function onGuildMemberUpdate({ guildId }: { guildId?: string; }) {
    if (guildId) checkGuild(guildId);
}

export default definePlugin({
    name: "AntiNickname",
    description: "Automatically resets your nickname back to a locked value in servers you configure, undoing any nickname a moderator forces on you",
    tags: ["Utility"],
    authors: [Devs.HyperCordTeam],
    settings,

    start() {
        FluxDispatcher.subscribe("GUILD_MEMBER_UPDATE", onGuildMemberUpdate);
    },

    stop() {
        FluxDispatcher.unsubscribe("GUILD_MEMBER_UPDATE", onGuildMemberUpdate);
    }
});
