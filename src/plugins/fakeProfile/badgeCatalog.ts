/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface CatalogBadge {
    key: string;
    label: string;
    iconSrc: string;
}

export interface CatalogCategory {
    title: string;
    badges: CatalogBadge[];
    /** Real Discord only ever grants one badge from this category at a time - picking one deselects the rest */
    exclusive?: boolean;
}

// These are Discord's own real badge assets (discord.com/assets/<hash>.svg and
// cdn.discordapp.com/badge-icons/<hash>.png) - the same files the real badges
// use, not lookalike emoji. Picking one should render indistinguishably from
// the genuine article. Cross-checked against multiple independent public
// badge-hash references before use.
export const BADGE_CATALOG: CatalogCategory[] = [
    {
        title: "General",
        badges: [
            { key: "staff", label: "Discord Staff", iconSrc: "https://discord.com/assets/48d5bdcffe9e7848067c2e187f1ef951.svg" },
            { key: "partner", label: "Partner", iconSrc: "https://discord.com/assets/34306011e46e87f8ef25f3415d3b99ca.svg" },
            { key: "hypesquad", label: "HypeSquad Events", iconSrc: "https://discord.com/assets/e666a84a7a5ea2abbbfa73adf22e627b.svg" },
            { key: "active_developer", label: "Active Developer", iconSrc: "https://discord.com/assets/26c7a60fb1654315e0be26107bd47470.svg" },
        ]
    },
    {
        title: "Bug Hunter",
        badges: [
            { key: "bug_hunter_1", label: "Bug Hunter (Level 1)", iconSrc: "https://discord.com/assets/8353d89b529e13365c415aef08d1d1f4.svg" },
            { key: "bug_hunter_2", label: "Bug Hunter (Level 2)", iconSrc: "https://discord.com/assets/f599063762165e0d23e8b11b684765a8.svg" },
        ]
    },
    {
        title: "Supporter & Developer",
        badges: [
            { key: "early_supporter", label: "Early Supporter", iconSrc: "https://discord.com/assets/b802e9af134ff492276d94220e36ec5c.svg" },
            { key: "verified_developer", label: "Verified Bot Developer", iconSrc: "https://discord.com/assets/4441e07fe0f46b3cb41b79366236fca6.svg" },
            { key: "certified_moderator", label: "Certified Moderator", iconSrc: "https://discord.com/assets/c981e58b5ea4b7fedd3a643cf0c60564.svg" },
        ]
    },
    {
        title: "HypeSquad Houses",
        exclusive: true,
        badges: [
            { key: "house_bravery", label: "HypeSquad Bravery", iconSrc: "https://discord.com/assets/efcc751513ec434ea4275ecda4f61136.svg" },
            { key: "house_brilliance", label: "HypeSquad Brilliance", iconSrc: "https://discord.com/assets/ec8e92568a7c8f19a052ef42f862ff18.svg" },
            { key: "house_balance", label: "HypeSquad Balance", iconSrc: "https://discord.com/assets/9f00b18e292e10fc0ae84ff5332e8b0b.svg" },
        ]
    },
    {
        title: "Quest",
        badges: [
            { key: "quest", label: "Quest Completed", iconSrc: "https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png" },
        ]
    },
    {
        // "Classic" isn't a tenure tier like the rest - it's just the plain
        // Nitro badge with no subscription-length decoration yet, which is
        // what a real Nitro Classic subscriber's badge actually looks like.
        title: "Nitro",
        exclusive: true,
        badges: [
            { key: "nitro_classic", label: "Nitro Classic", iconSrc: "https://discord.com/assets/24d05f3b46a110e538674edbac0db4cd.svg" },
            { key: "nitro_bronze", label: "Nitro — Bronze (1 Month)", iconSrc: "https://discord.com/assets/0386191373eb17c272df.svg" },
            { key: "nitro_silver", label: "Nitro — Silver (3 Months)", iconSrc: "https://discord.com/assets/9d4d362c62da3c985845.svg" },
            { key: "nitro_gold", label: "Nitro — Gold (6 Months)", iconSrc: "https://discord.com/assets/8725fe12ada9afa51c1a.svg" },
            { key: "nitro_platinum", label: "Nitro — Platinum (12 Months)", iconSrc: "https://discord.com/assets/746689c803e06be87705.svg" },
            { key: "nitro_diamond", label: "Nitro — Diamond (24 Months)", iconSrc: "https://discord.com/assets/f3521e2861ff44a0384d.svg" },
            { key: "nitro_emerald", label: "Nitro — Emerald (36 Months)", iconSrc: "https://discord.com/assets/f2b9b02fb22cc6459922.svg" },
            { key: "nitro_ruby", label: "Nitro — Ruby (60 Months)", iconSrc: "https://discord.com/assets/ecf86e18838013c9d95a.svg" },
            { key: "nitro_opal", label: "Nitro — Opal (72+ Months)", iconSrc: "https://discord.com/assets/b4fc7a9c37ec2fae36e3.svg" },
        ]
    },
    {
        title: "Server Boost",
        exclusive: true,
        badges: [
            { key: "boost_1", label: "Server Booster — 1 Month", iconSrc: "https://discord.com/assets/ca18353be0e57a2b3b3132fa1c08d6b4.svg" },
            { key: "boost_2", label: "Server Booster — 2 Months", iconSrc: "https://discord.com/assets/22f99ed6e34eaca48950254c70f8fe8d.svg" },
            { key: "boost_3", label: "Server Booster — 3 Months", iconSrc: "https://discord.com/assets/4a2618502278029ce88adeea179ed435.svg" },
            { key: "boost_6", label: "Server Booster — 6 Months", iconSrc: "https://discord.com/assets/fbafa6adb7c49a6a2c3822521ff2af2f.svg" },
            { key: "boost_9", label: "Server Booster — 9 Months", iconSrc: "https://discord.com/assets/0599f90e32c15b532647163edd72f70a.svg" },
            { key: "boost_12", label: "Server Booster — 12 Months", iconSrc: "https://discord.com/assets/e07c08cdc72bcc78b69c76d2c7ceb344.svg" },
            { key: "boost_15", label: "Server Booster — 15 Months", iconSrc: "https://discord.com/assets/c7f26927db5e7806790f4e968038630a.svg" },
            { key: "boost_18", label: "Server Booster — 18 Months", iconSrc: "https://discord.com/assets/c6d88d1d12afe03bdc4ebb747f8d196b.svg" },
            { key: "boost_24", label: "Server Booster — 24 Months", iconSrc: "https://discord.com/assets/d96ed283b74de75692487b7499fb8d09.svg" },
        ]
    },
];

export const BADGES_BY_KEY: Record<string, CatalogBadge> = Object.fromEntries(
    BADGE_CATALOG.flatMap(c => c.badges).map(b => [b.key, b])
);
