/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GuildMemberStore, GuildRoleStore, GuildStore, UserStore } from "@webpack/common";

import { SniperTier } from "../types";

/**
 * Resolves the authenticated tier for the current user safely
 */
export function resolveUserTier(): { tier: SniperTier; reason: string; roleName?: string; } {
    try {
        const user = UserStore?.getCurrentUser?.();
        if (!user || !user.id) {
            return { tier: "free", reason: "Giriş yapılmadı" };
        }

        const userId = user.id;

        // Check joined guilds safely
        const guilds = GuildStore?.getGuilds?.() || {};
        for (const guildId of Object.keys(guilds)) {
            try {
                const member = GuildMemberStore?.getMember?.(guildId, userId);
                if (!member || !Array.isArray(member.roles) || member.roles.length === 0) {
                    continue;
                }

                // getRolesSnapshot or getRoles or getSortedRoles
                const rolesMap = GuildRoleStore?.getRolesSnapshot?.(guildId) || GuildRoleStore?.getRoles?.(guildId) || {};

                for (const roleId of member.roles) {
                    let role = rolesMap[roleId];

                    // If rolesMap is an array or function
                    if (!role && Array.isArray(rolesMap)) {
                        role = rolesMap.find((r: any) => r && r.id === roleId);
                    }

                    if (!role || typeof role.name !== "string") continue;

                    // Never count Nitro / Server Booster roles
                    if (nameLower.includes("booster") || nameLower.includes("takviye") || nameLower.includes("boost")) {
                        continue;
                    }

                    // Check for VIP role (highest priority)
                    if (
                        nameLower === "vip" ||
                        nameLower.includes("👑") ||
                        nameLower.includes("vip")
                    ) {
                        return {
                            tier: "vip",
                            reason: `Sunucu Rolü: ${role.name}`,
                            roleName: role.name,
                        };
                    }

                    // Check for actual Destekçi role
                    if (
                        nameLower.includes("destekçi") ||
                        nameLower.includes("destekci") ||
                        nameLower === "supporter"
                    ) {
                        return {
                            tier: "supporter",
                            reason: `Sunucu Rolü: ${role.name}`,
                            roleName: role.name,
                        };
                    }
                }
            } catch {}
        }
    } catch {}

    // Default to free if no special role found
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
