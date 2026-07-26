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

// Kept for the Nitro tier badges specifically - the real discord.com/assets
// tenure SVGs looked worse here than this existing emoji set, so those stay
// on the old lookalike images while every other category uses the real ones.
function emojiUrl(id: string, animated = false) {
    return `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=64`;
}

// Most of these are Discord's own real badge assets (discord.com/assets/<hash>.svg
// and cdn.discordapp.com/badge-icons/<hash>.png) - the same files the real badges
// use, not lookalike emoji - cross-checked against multiple independent public
// badge-hash references before use. The Nitro tier badges are the exception: see
// emojiUrl below.
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
            { key: "nitro_classic", label: "Nitro Classic", iconSrc: emojiUrl("1528737728894734548") },
            { key: "nitro_bronze", label: "Nitro — Bronze (1 Month)", iconSrc: emojiUrl("1365454925357645994") },
            { key: "nitro_silver", label: "Nitro — Silver (3 Months)", iconSrc: emojiUrl("1365454972962996254") },
            { key: "nitro_gold", label: "Nitro — Gold (6 Months)", iconSrc: emojiUrl("1365454994337435739") },
            { key: "nitro_platinum", label: "Nitro — Platinum (12 Months)", iconSrc: emojiUrl("1436738175509987378") },
            { key: "nitro_diamond", label: "Nitro — Diamond (24 Months)", iconSrc: emojiUrl("1365455075937488967") },
            { key: "nitro_emerald", label: "Nitro — Emerald (36 Months)", iconSrc: emojiUrl("1365455096296509524") },
            { key: "nitro_ruby", label: "Nitro — Ruby (60 Months)", iconSrc: emojiUrl("1365455125187137536") },
            { key: "nitro_opal", label: "Nitro — Opal (72+ Months)", iconSrc: emojiUrl("1365455150260551740") },
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

// The catalog above is grouped for the picker UI (related badges kept
// together for browsing), which isn't the same as the order real Discord
// actually renders them in. That real order follows UserFlags bit order for
// the achievement badges (HypeSquad Houses land between Bug Hunter 1 and 2,
// Early Supporter before Bug Hunter 2, Active Developer near the very end),
// with Nitro/Boost tenure always last since those come from a separate
// subscription computation, not the flag bitfield.
const DISPLAY_ORDER = [
    "staff", "partner", "hypesquad",
    "bug_hunter_1",
    "house_bravery", "house_brilliance", "house_balance",
    "early_supporter",
    "bug_hunter_2",
    "verified_developer",
    "certified_moderator",
    "active_developer",
    "quest",
    "nitro_classic", "nitro_bronze", "nitro_silver", "nitro_gold", "nitro_platinum", "nitro_diamond", "nitro_emerald", "nitro_ruby", "nitro_opal",
    "boost_1", "boost_2", "boost_3", "boost_6", "boost_9", "boost_12", "boost_15", "boost_18", "boost_24",
];

/** Reorders badge keys to match real Discord's display order, regardless of what order they were picked in. */
export function sortByDisplayOrder(keys: string[]): string[] {
    return [...keys].sort((a, b) => DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b));
}
