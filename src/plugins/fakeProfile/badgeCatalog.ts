/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface CatalogBadge {
    key: string;
    label: string;
    iconSrc: string;
    /**
     * Kept resolvable (BADGES_BY_KEY, priority, sorting) but hidden from the
     * BadgePicker UI - for a badge that no longer matches anything a real
     * profile could show (removed/retired on real Discord) so it shouldn't
     * be newly pickable, WITHOUT retroactively stripping it from anyone who
     * already had it picked. A full delete instead of this flag silently
     * un-syncs an existing pick on that user's very next resync (their
     * client can no longer resolve the key to push it), which is a real bug
     * this once caused, not a hypothetical.
     */
    hidden?: boolean;
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
//
// discord.com/assets/<hash>.svg is Discord's WEBPACK BUNDLE asset output, tied to
// a specific frontend build - Canary/PTB run different (usually newer) bundles
// than Stable, so a hash captured against one channel can 404 on another (same
// risk class already called out for regex patches elsewhere in this repo).
// cdn.discordapp.com/badge-icons/<hash>.png is Discord's actual stable, channel-
// independent badge CDN - every non-Nitro-tier badge in this catalog was moved
// to it 2026-07-29 after Canary/PTB reports of missing images (Nitro tiers stay
// on the emoji lookalikes below on purpose, see a399a50). Hashes cross-checked
// against showBadgesInChat/index.tsx (staff/hypesquad/bug hunter/early
// supporter) and turkwr/badge-scraper's public badge hash map (partner/
// active_developer/verified_developer/certified_moderator/all boost_* tiers) -
// every hash HTTP-verified (200) before use, not guessed. If a badge is ever
// added here without a hash confirmed from one of those kinds of sources,
// don't assume a discord.com/assets URL will keep working on every channel.
export const BADGE_CATALOG: CatalogCategory[] = [
    {
        title: "General",
        badges: [
            { key: "staff", label: "Discord Staff", iconSrc: "https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png" },
            { key: "partner", label: "Partnered Server Owner", iconSrc: "https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png" },
            { key: "hypesquad", label: "HypeSquad Events", iconSrc: "https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png" },
            // Real Discord removed the ability to earn/hold this badge
            // entirely - hidden (not deleted) so it no longer offers as a
            // fresh pick, but anyone who already had it keeps it.
            { key: "active_developer", label: "Active Developer", iconSrc: "https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png", hidden: true },
        ]
    },
    {
        title: "Bug Hunter",
        badges: [
            { key: "bug_hunter_1", label: "Bug Hunter (Level 1)", iconSrc: "https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png" },
            { key: "bug_hunter_2", label: "Bug Hunter (Level 2)", iconSrc: "https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png" },
        ]
    },
    {
        title: "Supporter & Developer",
        badges: [
            { key: "early_supporter", label: "Early Supporter", iconSrc: "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png" },
            // Real Discord's actual current tooltip text for both of these -
            // "Verified Bot Developer"/"Certified Moderator" are the older
            // names, kept as the tr.ts lookup fallback below but no longer
            // what's shown. Keys stay as-is (still match
            // verified_developer/certified_moderator's real badge id regex).
            { key: "verified_developer", label: "Early Verified Bot Developer", iconSrc: "https://cdn.discordapp.com/badge-icons/6df5892e0f35b051f8b61eace34f4967.png" },
            { key: "certified_moderator", label: "Moderator Programs Alumni", iconSrc: "https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png" },
        ]
    },
    {
        title: "HypeSquad Houses",
        exclusive: true,
        badges: [
            { key: "house_bravery", label: "HypeSquad Bravery", iconSrc: "https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png" },
            { key: "house_brilliance", label: "HypeSquad Brilliance", iconSrc: "https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png" },
            { key: "house_balance", label: "HypeSquad Balance", iconSrc: "https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png" },
        ]
    },
    {
        // Hidden by our own product decision (a 2-click quest completion
        // doesn't fit the "something non-trivial" bar the rest of this
        // catalog holds to) rather than because it stopped being real -
        // existing holders keep it, same reasoning as the hidden flag
        // elsewhere in this file.
        title: "Quest",
        badges: [
            { key: "quest", label: "Quest Completed", iconSrc: "https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png", hidden: true },
        ]
    },
    {
        // A real (if now grandfathered-only) badge - anyone who hadn't
        // migrated off the old username#0000 system still shows this.
        // Not hidden: unlike Active Developer/Nitro Classic/boost_15, this
        // still matches something real current profiles can show.
        title: "Legacy Username",
        badges: [
            { key: "legacy_username", label: "Legacy Username", iconSrc: "https://cdn.discordapp.com/badge-icons/6de6d34650760ba5551a79732e98ed60.png" },
        ]
    },
    {
        // Time-limited April 2026 event badge, no longer newly obtainable,
        // but same as Legacy Username/Early Supporter - real accounts that
        // earned it during the window still show it, so not hidden.
        title: "Last Meadow Online",
        badges: [
            { key: "last_meadow_online", label: "Last Meadow Online", iconSrc: "https://cdn.discordapp.com/badge-icons/ca105ad9cfc8580c765101d17bbb2323.png" },
        ]
    },
    {
        // Paid (120 Orbs) shop badge - couldn't find a verified real
        // badge-icons.<hash>.png for this one specifically (unlike every
        // other badge here), so this uses the Fandom-hosted copy of the
        // real image instead of guessing a Discord CDN hash.
        title: "Orbs Apprentice",
        badges: [
            { key: "orbs_apprentice", label: "Orbs Apprentice", iconSrc: "https://static.wikia.nocookie.net/discord/images/f/fa/OrbsApprentice.png/revision/latest?cb=20250529140649" },
        ]
    },
    {
        title: "Nitro",
        exclusive: true,
        badges: [
            // Real Discord retired Nitro Classic as a purchasable tier -
            // hidden (not deleted), same reasoning as Active Developer above.
            { key: "nitro_classic", label: "Nitro Classic", iconSrc: emojiUrl("1528737728894734548"), hidden: true },
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
            { key: "boost_1", label: "Server Booster — 1 Month", iconSrc: "https://cdn.discordapp.com/badge-icons/51040c70d4f20a921ad6674ff86fc95c.png" },
            { key: "boost_2", label: "Server Booster — 2 Months", iconSrc: "https://cdn.discordapp.com/badge-icons/0e4080d1d333bc7ad29ef6528b6f2fb7.png" },
            { key: "boost_3", label: "Server Booster — 3 Months", iconSrc: "https://cdn.discordapp.com/badge-icons/72bed924410c304dbe3d00a6e593ff59.png" },
            { key: "boost_6", label: "Server Booster — 6 Months", iconSrc: "https://cdn.discordapp.com/badge-icons/df199d2050d3ed4ebf84d64ae83989f8.png" },
            { key: "boost_9", label: "Server Booster — 9 Months", iconSrc: "https://cdn.discordapp.com/badge-icons/996b3e870e8a22ce519b3a50e6bdd52f.png" },
            { key: "boost_12", label: "Server Booster — 12 Months", iconSrc: "https://cdn.discordapp.com/badge-icons/991c9f39ee33d7537d9f408c3e53141e.png" },
            // Not a real tier (real Discord's boost badges only exist at
            // 1/2/3/6/9/12/18/24 months) - hidden rather than deleted, same
            // reasoning as Active Developer/Nitro Classic/Quest above.
            { key: "boost_15", label: "Server Booster — 15 Months", iconSrc: "https://cdn.discordapp.com/badge-icons/cb3ae83c15e970e8f3d410bc62cb8b99.png", hidden: true },
            { key: "boost_18", label: "Server Booster — 18 Months", iconSrc: "https://cdn.discordapp.com/badge-icons/7142225d31238f6387d9f09efaa02759.png" },
            { key: "boost_24", label: "Server Booster — 24 Months", iconSrc: "https://cdn.discordapp.com/badge-icons/ec92202290b48d0879b7413d2dde3bab.png" },
        ]
    },
    {
        // Not a real Discord badge category (Discord has no persistent
        // "gifted Nitro to someone" badge) - a fake tenure-style tier ladder
        // requested by users. Custom-made icons (docs/gifting-*.png, hosted
        // via raw.githubusercontent.com same as CONTRIBUTOR_BADGE/docs/booster.png
        // above), not reused Discord CDN assets like the other categories.
        title: "Gift Giving",
        exclusive: true,
        badges: [
            // Versioned filenames on purpose (not the original gifting-*.png
            // names) - overwriting the same filename's bytes wasn't enough to
            // make clients pick up a re-padded PNG, likely a same-URL image
            // cache (Electron/Chromium disk cache, keyed by URL) serving the
            // old bytes indefinitely. A genuinely new URL forces every client
            // to actually fetch the new file. v2's 200px-art-on-330px-canvas
            // (~60% fill) turned out too small once actually seen live -
            // v3 dials back to a 250px canvas (~80% fill).
            { key: "gifter_patron", label: "Gift Giver — Patron", iconSrc: "https://raw.githubusercontent.com/hypercordapp/hypercord/main/docs/gifting-patron-v3.png" },
            { key: "gifter_champion", label: "Gift Giver — Champion", iconSrc: "https://raw.githubusercontent.com/hypercordapp/hypercord/main/docs/gifting-champion-v3.png" },
            { key: "gifter_luminary", label: "Gift Giver — Luminary", iconSrc: "https://raw.githubusercontent.com/hypercordapp/hypercord/main/docs/gifting-luminary-v3.png" },
            { key: "gifter_icon", label: "Gift Giver — Icon", iconSrc: "https://raw.githubusercontent.com/hypercordapp/hypercord/main/docs/gifting-icon-v3.png" },
            { key: "gifter_hero", label: "Gift Giver — Hero", iconSrc: "https://raw.githubusercontent.com/hypercordapp/hypercord/main/docs/gifting-hero-v3.png" },
            { key: "gifter_legend", label: "Gift Giver — Legend", iconSrc: "https://raw.githubusercontent.com/hypercordapp/hypercord/main/docs/gifting-legend-v3.png" },
        ]
    },
];

// Object.create(null) (no Object.prototype) rather than a plain {} - this
// gets indexed by a catalogKey that arrived over the network (see
// _api/badges' getDonorBadges), and a plain object would resolve
// BADGES_BY_KEY["__proto__"]/["constructor"]/["toString"] etc. to a real
// (if useless) inherited value instead of undefined, since those aren't
// actual own properties. Not exploitable for RCE/pollution here (nothing
// ever writes through this lookup), but callers relying on a falsy/absent
// result to fall back safely would silently misbehave instead.
export const BADGES_BY_KEY: Record<string, CatalogBadge> = BADGE_CATALOG.flatMap(c => c.badges).reduce(
    (map, b) => {
        map[b.key] = b;
        return map;
    },
    Object.create(null) as Record<string, CatalogBadge>
);

// The catalog above is grouped for the picker UI (related badges kept
// together for browsing), which isn't the same as the order they actually
// render in. Explicit order given directly by the user (both TR and EN
// requested the same sequence): Staff -> Partnered Server Owner -> HypeSquad
// Events -> Bug Hunter -> Early Verified Bot Developer -> Nitro -> Early
// Supporter -> Server Booster -> Moderator Programs Alumni -> HypeSquad
// Houses -> Legacy Username -> Quest -> Last Meadow Online -> Orbs
// Apprentice -> Gift Giving. active_developer isn't in that list (hidden/
// retired, see badgeCatalog.ts's own comment) - tucked in right after Quest
// rather than left in its old slot, since nothing in the requested order
// depends on exactly where a hidden badge falls.
const DISPLAY_ORDER = [
    "staff", "partner", "hypesquad",
    "bug_hunter_1", "bug_hunter_2",
    "verified_developer",
    "nitro_classic", "nitro_bronze", "nitro_silver", "nitro_gold", "nitro_platinum", "nitro_diamond", "nitro_emerald", "nitro_ruby", "nitro_opal",
    "early_supporter",
    "boost_1", "boost_2", "boost_3", "boost_6", "boost_9", "boost_12", "boost_15", "boost_18", "boost_24",
    "certified_moderator",
    "house_bravery", "house_brilliance", "house_balance",
    "legacy_username",
    "quest", "active_developer",
    "last_meadow_online",
    "orbs_apprentice",
    "gifter_patron", "gifter_champion", "gifter_luminary", "gifter_icon", "gifter_hero", "gifter_legend",
];

/** Reorders badge keys to match real Discord's display order, regardless of what order they were picked in. */
export function sortByDisplayOrder(keys: string[]): string[] {
    return [...keys].sort((a, b) => DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b));
}
