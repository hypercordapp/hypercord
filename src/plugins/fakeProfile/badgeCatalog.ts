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

function emojiUrl(id: string, animated = false) {
    return `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=64`;
}

export const BADGE_CATALOG: CatalogCategory[] = [
    {
        title: "General",
        badges: [
            { key: "staff", label: "Discord Staff", iconSrc: emojiUrl("1362105228719034679") },
            { key: "partner", label: "Partner", iconSrc: emojiUrl("1362105185094336622") },
            { key: "hypesquad", label: "HypeSquad Events", iconSrc: emojiUrl("1362105087006212456") },
            { key: "active_developer", label: "Active Developer", iconSrc: emojiUrl("1362104965065212074") },
        ]
    },
    {
        title: "Bug Hunter",
        badges: [
            { key: "bug_hunter_1", label: "Bug Hunter (Level 1)", iconSrc: emojiUrl("1362105034157981758") },
            { key: "bug_hunter_2", label: "Bug Hunter (Level 2)", iconSrc: emojiUrl("1362105047462314293") },
        ]
    },
    {
        title: "Supporter & Developer",
        badges: [
            { key: "early_supporter", label: "Early Supporter", iconSrc: emojiUrl("1362105166811103515") },
            { key: "verified_developer", label: "Verified Bot Developer", iconSrc: emojiUrl("1362105068060676329") },
            { key: "certified_moderator", label: "Certified Moderator", iconSrc: emojiUrl("1362105108170539229") },
        ]
    },
    {
        title: "HypeSquad Houses",
        exclusive: true,
        badges: [
            { key: "house_bravery", label: "HypeSquad Bravery", iconSrc: emojiUrl("1362105004089147784") },
            { key: "house_brilliance", label: "HypeSquad Brilliance", iconSrc: emojiUrl("1362105019066748968") },
            { key: "house_balance", label: "HypeSquad Balance", iconSrc: emojiUrl("1362104986330202172") },
        ]
    },
    {
        title: "Quest",
        badges: [
            { key: "quest", label: "Quest Completed", iconSrc: emojiUrl("1362105209496801290") },
        ]
    },
    {
        title: "Nitro",
        exclusive: true,
        badges: [
            { key: "nitro_classic", label: "Nitro Classic", iconSrc: emojiUrl("1528737728894734548") },
            { key: "nitro_bronze", label: "Nitro — Bronze", iconSrc: emojiUrl("1365454925357645994") },
            { key: "nitro_silver", label: "Nitro — Silver", iconSrc: emojiUrl("1365454972962996254") },
            { key: "nitro_gold", label: "Nitro — Gold", iconSrc: emojiUrl("1365454994337435739") },
            { key: "nitro_platinum", label: "Nitro — Platinum", iconSrc: emojiUrl("1436738175509987378") },
            { key: "nitro_diamond", label: "Nitro — Diamond", iconSrc: emojiUrl("1365455075937488967") },
            { key: "nitro_emerald", label: "Nitro — Emerald", iconSrc: emojiUrl("1365455096296509524") },
            { key: "nitro_ruby", label: "Nitro — Ruby", iconSrc: emojiUrl("1365455125187137536") },
            { key: "nitro_opal", label: "Nitro — Opal", iconSrc: emojiUrl("1365455150260551740") },
        ]
    },
    {
        title: "Server Boost",
        exclusive: true,
        badges: [
            { key: "boost_1", label: "Server Booster — 1 Month", iconSrc: emojiUrl("1387742464202379324") },
            { key: "boost_2", label: "Server Booster — 2 Months", iconSrc: emojiUrl("1387742437723602975") },
            { key: "boost_3", label: "Server Booster — 3 Months", iconSrc: emojiUrl("1387742527339102338") },
            { key: "boost_6", label: "Server Booster — 6 Months", iconSrc: emojiUrl("1387742439477088287") },
            { key: "boost_9", label: "Server Booster — 9 Months", iconSrc: emojiUrl("1387742529289457674") },
            { key: "boost_12", label: "Server Booster — 12 Months", iconSrc: emojiUrl("1387742435769061417") },
            { key: "boost_15", label: "Server Booster — 15 Months", iconSrc: emojiUrl("1387742462629511270") },
            { key: "boost_18", label: "Server Booster — 18 Months", iconSrc: emojiUrl("1387742525699260538") },
            { key: "boost_24", label: "Server Booster — 24 Months", iconSrc: emojiUrl("1387742436742139974") },
        ]
    },
];

export const BADGES_BY_KEY: Record<string, CatalogBadge> = Object.fromEntries(
    BADGE_CATALOG.flatMap(c => c.badges).map(b => [b.key, b])
);
