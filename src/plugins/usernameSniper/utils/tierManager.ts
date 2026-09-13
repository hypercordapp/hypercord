/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GuildMemberStore, GuildRoleStore, GuildStore, UserStore } from "@webpack/common";

import { SniperTier } from "../types";

/**
 * Resolves the authenticated tier for the current user based on:
 * 1. Server roles (VIP, Destekçi / Supporter) across joined guilds (HyperCord official server)
 * 2. API / Donor checks
 */
export function resolveUserTier(): { tier: SniperTier; reason: string; roleName?: string; } {
    const user = UserStore.getCurrentUser();
    if (!user) {
        return { tier: "free", reason: "Giriş yapılmadı" };
    }

    const userId = user.id;

    // Check all joined guilds for VIP and Destekçi roles
    const guilds = GuildStore.getGuilds();
    for (const guildId in guilds) {
        const member = GuildMemberStore.getMember(guildId, userId);
        if (!member || !member.roles) continue;

        const roles = GuildRoleStore.getRoles(guildId);
        if (!roles) continue;

        for (const roleId of member.roles) {
            const role = roles[roleId];
            if (!role || !role.name) continue;

            const nameLower = role.name.toLowerCase().trim();

            // Check for VIP role (highest priority)
            if (
                nameLower === "vip" ||
                nameLower.includes("👑") ||
                nameLower.includes("vip") ||
                nameLower.includes("premium") ||
                nameLower.includes("elmas")
            ) {
                return {
                    tier: "vip",
                    reason: `Sunucu Rolü: ${role.name}`,
                    roleName: role.name,
                };
            }

            // Check for Destekçi / Supporter role
            if (
                nameLower.includes("destekçi") ||
                nameLower.includes("destekci") ||
                nameLower.includes("supporter") ||
                nameLower.includes("booster") ||
                nameLower.includes("altın")
            ) {
                return {
                    tier: "supporter",
                    reason: `Sunucu Rolü: ${role.name}`,
                    roleName: role.name,
                };
            }
        }
    }

    // Default to free
    return { tier: "free", reason: "Rol bulunamadı" };
}

/**
 * Validates if the user is authorized to run the given mode
 */
export function validateModeAccess(mode: string, tier: SniperTier): boolean {
    if (tier === "vip") return true;
    if (tier === "supporter") {
        return mode.startsWith("4l");
    }
    return false;
}
