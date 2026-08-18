/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import "./fixDiscordBadgePadding.css";
import "./nitroTenureCard.css";

import { _getBadges, BadgePosition, BadgeUserArgs, ProfileBadge } from "@api/Badges";
import { Settings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { openContributorModal } from "@components/settings/tabs";
import { t } from "@i18n";
import { openSettingsPage } from "@plugins/commandPalette/commands/openSettings";
import { BADGE_CATALOG, BADGES_BY_KEY } from "@plugins/fakeProfile/badgeCatalog";
import { Devs } from "@utils/constants";
import { copyWithToast } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { shouldShowContributorBadge } from "@utils/misc";
import definePlugin from "@utils/types";
import { ContextMenuApi, Menu, SnowflakeUtils, Toasts, UserStore } from "@webpack/common";

// Was raw.githubusercontent.com directly - moved to badge-api's own cached
// CDN (2026-08-17) after a real GitHub-wide outage ("Archive downloads and
// raw repository content downloads" degraded ~50% per githubstatus.com,
// confirmed live, not guessed) broke most of the client's images at once,
// same failure mode already fixed today for the installer/changelog/plugin
// pages - every user's client hitting raw.githubusercontent.com directly,
// unauthenticated, with zero caching, was always one GitHub incident away
// from exactly this. Content-hashed, so re-uploading the same file is a
// no-op if this ever needs to be redone.
const CONTRIBUTOR_BADGE = "https://api.hypercord.pro/img/b8f970fa4f5bfbba7dafe6588f143ac60c6e44fc88cdd4e05d44d0c3c3f690f9.png";

// Matches real Discord's own "14 Şub 2026 tarihinden beri sunucu takviyesi
// yapıyor" tenure-badge date format (confirmed against a real screenshot) -
// day + abbreviated month name + year, not a numeric date.
const TR_MONTH_ABBR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const EN_MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Short tier name for the Nitro hover card title ("NITRO YAKUT") - unlike
// boost's tooltip (confirmed to be real Discord's own plain small tooltip),
// a user-provided screenshot specifically showed Nitro tenure rendered as a
// big styled card with just the tier color name, not the full catalog label
// ("Nitro — Ruby (60 Months)").
const NITRO_TIER_SHORT_NAME: Record<string, { en: string; tr: string; }> = {
    nitro_bronze: { en: "Bronze", tr: "Bronz" },
    nitro_silver: { en: "Silver", tr: "Gümüş" },
    nitro_gold: { en: "Gold", tr: "Altın" },
    nitro_platinum: { en: "Platinum", tr: "Platin" },
    nitro_diamond: { en: "Diamond", tr: "Elmas" },
    nitro_emerald: { en: "Emerald", tr: "Zümrüt" },
    nitro_ruby: { en: "Ruby", tr: "Yakut" },
    nitro_opal: { en: "Opal", tr: "Opal" },
};
// Same threat model + fix as CATALOG_KEY_PRIORITY further down (also
// indexed by badge.catalogKey) - without this, a crafted "constructor"
// catalogKey resolves to a real inherited function (truthy, so it passes
// the `tierName &&` check below) instead of undefined, and .tr/.en on a
// function are just undefined, silently producing a "Nitro undefined"
// title instead of falling through to the plain-badge path like every
// other unrecognized catalogKey does.
Object.setPrototypeOf(NITRO_TIER_SHORT_NAME, null);

// The real ornate winged-crest badge art (originally sourced from Fandom,
// re-hosted in docs/nitro-badges/ - Fandom's static.wikia.nocookie.net
// revision/latest redirect turned out unreliable, caught a live 404 on the
// exact same URL that had 200'd moments earlier) - used ONLY inside the
// hover card below, never as the small picker/tray icon (badgeCatalog.ts's
// own iconSrc stays on the plain emoji lookalikes for that - using this
// art there too was tried and explicitly reported wrong, it's sized/
// composed for a big card, not a small badge).
//
// Was raw.githubusercontent.com directly, same as CONTRIBUTOR_BADGE above -
// see that constant's comment for why these moved to badge-api's own
// cached CDN instead (a real GitHub-wide raw-content outage, not a guess).
const NITRO_TIER_CARD_ICON: Record<string, string> = {
    nitro_bronze: "https://api.hypercord.pro/img/bcb5eb9a63891be7781a5b033d676c48a2e8c96039ffd26b35dc6394b8c02c85.png",
    nitro_silver: "https://api.hypercord.pro/img/38a99e001394089cea1c2264ffe64e8acfc6b6d4005f0e87c65d3e1d705c67db.png",
    nitro_gold: "https://api.hypercord.pro/img/34551e09104e17dbfba18e7a7b4ff3d4c2ef82854c067058d9c64bab6fba6c16.png",
    nitro_platinum: "https://api.hypercord.pro/img/a6f4aa2d73fff3f858f23f044a4c4e236d12ddefc185c3087dc6483e285f7aeb.png",
    nitro_diamond: "https://api.hypercord.pro/img/fd6c2306163b2acf1ff996303fa523a39063aed9353430beeced8e11830da761.png",
    nitro_emerald: "https://api.hypercord.pro/img/bd1e4534c7343a17f17b20b038073615b7e4d8c9eeb8e371661c01001dd65760.png",
    nitro_ruby: "https://api.hypercord.pro/img/1b185ab83870c836a9f506105803131506bf454899f1f33c11f281fb9afe27a5.png",
    nitro_opal: "https://api.hypercord.pro/img/e4d888d3d857be56d2e3a0a170f31ab938d0b5ece208369f8d64aefd2380a87f.png",
};
// Same threat model + same fix as CATALOG_KEY_PRIORITY/BADGES_BY_KEY below
// (see that Object.setPrototypeOf's own comment) - this is indexed by
// badge.catalogKey too, so a crafted "constructor"/"__proto__"/"toString"
// key would otherwise resolve to a real inherited function instead of
// undefined, silently bypassing the `?? badge.badge` fallback (a function
// isn't nullish, so `??` doesn't catch it) instead of falling through as
// every other unrecognized key does.
Object.setPrototypeOf(NITRO_TIER_CARD_ICON, null);

// Per-tier gradient glow - corrects the previous hardcoded-oklab approach
// (which also had the mask/order/interpolation wrong, see nitroTenureCard.
// css). Live-inspected an actual Nitro-tenure-holding account's real hover
// card via CDP (walked the DOM up from the tooltip's own <h2>, then dumped
// document.styleSheets for the exact matching CSS text) - real Discord's
// card sets `--custom-gradient-color-start/-end` directly to
// `var(--expressive-gradient-tenure-badge-{tier}-start/-end)` and lets its
// shared ::before rule consume those vars, rather than resolving them to a
// static color. Referencing the real token names (not their resolved
// values) means we inherit Discord's own alpha/light-dark handling for
// free and never drift out of sync - just map our catalog keys to
// Discord's tier name suffix.
const NITRO_TIER_TOKEN_NAME: Record<string, string> = {
    nitro_bronze: "bronze",
    nitro_silver: "silver",
    nitro_gold: "gold",
    nitro_platinum: "platinum",
    nitro_diamond: "diamond",
    nitro_emerald: "emerald",
    nitro_ruby: "ruby",
    nitro_opal: "opal",
};
// Same fix, same reason as NITRO_TIER_CARD_ICON above.
Object.setPrototypeOf(NITRO_TIER_TOKEN_NAME, null);

// Structure + every measurement here is CONFIRMED real: live-captured via
// CDP against an actual Nitro tenure badge's own hover card (240px total
// width, not 208 - that's the inner content width once the real card's own
// 16px padding is subtracted; an earlier version put both `width: 208` AND
// `padding: 16` on the same border-box element, which actually rendered a
// too-narrow 176px content area). Styling lives in nitroTenureCard.css -
// see its comment for why the surrounding wrapper Discord itself provides
// (see this component's call site below) gets its own chrome stripped via
// a `:has()` rule rather than layered underneath this card.
// The caret's own colors are real too (live-captured): fill is the same
// `var(--background-surface-high)` as the card itself, stroke is
// `var(--border-subtle)` (same token as the card's own inset border), and
// the gradient-tint path real Discord layers on top of some carets
// resolves to fully transparent for this "custom position" variant - no
// per-tier tint needed here, unlike the card's own glow. Wrapped in its
// own outer div (not a child of .hc-nitro-tenure-card) because the card
// needs `overflow: hidden` for its glow mask, which would otherwise clip
// the caret poking out below the card's bottom edge.
function NitroSinceHoverCard({ iconSrc, tierName, description, tierToken }: { iconSrc: string; tierName: string; description: string; tierToken: string; }) {
    return (
        <div className="hc-nitro-tenure-wrapper">
            <div
                className="hc-nitro-tenure-card"
                style={{
                    "--hc-tier-start": `var(--expressive-gradient-tenure-badge-${tierToken}-start)`,
                    "--hc-tier-end": `var(--expressive-gradient-tenure-badge-${tierToken}-end)`
                } as React.CSSProperties}
            >
                <div className="hc-nitro-tenure-content">
                    <div className="hc-nitro-tenure-graphic">
                        <img src={iconSrc} alt="" />
                    </div>
                    <div className="hc-nitro-tenure-header">
                        {/* lang="en" opts this element out of Chromium's Turkish
                            case-folding rule (i -> İ) for CSS text-transform:
                            uppercase, which otherwise turns "Nitro" into "Nİtro"
                            whenever Discord's own client language is Turkish -
                            "Nitro" is a brand name and must stay ASCII "NITRO"
                            regardless of locale, matching real Discord. */}
                        <h2 className="hc-nitro-tenure-title" lang="en">{tierName}</h2>
                        <div className="hc-nitro-tenure-desc">{description}</div>
                    </div>
                </div>
            </div>
            <svg className="hc-nitro-tenure-caret" width="22" height="14" viewBox="0 0 22 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path className="hc-nitro-tenure-caret-fill" d="M14.0535 9.39127C12.4557 11.2796 9.54425 11.2796 7.94646 9.39127L1 1Q0 0 1 0L21 0Q22 0 21 1L14.0535 9.39127Z" />
                <mask id="hc-nitro-tenure-caret-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="22" height="11">
                    <path fill="#fff" d="M14.0535 9.39126C12.4557 11.2796 9.54425 11.2796 7.94646 9.39126L1 1Q0 0 1 0L21 0Q22 0 21 1L14.0535 9.39126Z" />
                </mask>
                <g mask="url(#hc-nitro-tenure-caret-mask)">
                    <path className="hc-nitro-tenure-caret-stroke" d="M13.6572 9.13184C12.2604 10.761 9.73957 10.761 8.34277 9.13184L1.0869141 0.5Q0.0869141 -0.5 1.0869141 -0.5L20.9131 -0.5Q21.9131 -0.5 20.9131 0.5L13.6572 9.13184Z" />
                </g>
            </svg>
        </div>
    );
}

const ContributorBadge: ProfileBadge = {
    id: "hypercord_contributor_badge",
    description: "HyperCord Contributor",
    iconSrc: CONTRIBUTOR_BADGE,
    position: BadgePosition.START,
    shouldShow: ({ userId }) => shouldShowContributorBadge(userId),
    onClick: (_, { userId }) => openContributorModal(UserStore.getUser(userId))
};

// decoration/nameplate/profileEffect are real Discord cosmetic objects
// (AvatarDecorationData/Nameplate/ProfileEffect-shaped, each with at least a
// `skuId`) captured live off another real user's profile by FakeProfile - not
// something we host ourselves, unlike banner.
interface ProfileOverride {
    // catalogKey is the FakeProfile badgeCatalog.ts key this badge was
    // picked from (e.g. "bug_hunter_1") - optional since custom/admin badges
    // and pre-catalogKey synced data don't have one, in which case the raw
    // tooltip (baked in whatever language the owner had selected) is used as
    // a fallback, see getDonorBadges below.
    badges: Array<Record<"tooltip" | "badge", string> & { catalogKey?: string }>;
    avatar: string | null;
    banner: string | null;
    decoration: Record<string, unknown> | null;
    nameplate: Record<string, unknown> | null;
    profileEffect: Record<string, unknown> | null;
    displayNameStyle: Record<string, unknown> | null;
    createdAt: string | null;
    // Same "just a typed ISO date, no real one to capture" shape as
    // createdAt - doesn't replace anything, combines with whichever Server
    // Boost tier is already picked (see getDonorBadges' boost special case)
    // to swap that badge's description to the real "since <date>" wording.
    // No date set -> renders exactly like every other plain catalog badge.
    boostSince: string | null;
    // Same shape as boostSince, but upgrades the matching Nitro tier badge
    // to a styled "tier name + since date" card (see getDonorBadges' nitro
    // special case) instead of just swapping its description text - matches
    // a reference screenshot the user provided. No date set -> renders
    // exactly like every other plain catalog badge, unchanged.
    nitroSince: string | null;
    // A real, client-observed log of the user's own past usernames - never
    // hand-typed, see FakeProfile's recordUsernameChange(). Only entries
    // within the last 12 months are meant to be here at all (the client
    // prunes before syncing), but this also re-checks at render time in case
    // stale data ever lingers.
    formerUsername: Array<{ name: string; until: string }> | null;
    // FakeProfile's basic username/display-name override - Discord's own
    // username system can't be spoofed for other people client-side, so this
    // has to be a real synced value read back here (see the required, always-
    // on getUser/getCurrentUser patch below) rather than a local-only fake,
    // the same lesson already learned once for createdAt/decoration/etc.
    fakeIdentity: { username?: string; globalName?: string; } | null;
}

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

let ProfileOverrides = {} as Record<string, ProfileOverride>;

const PROFILES_URL = "https://api.hypercord.pro/profiles";

async function loadBadges(noCache = false) {
    try {
        const init = {} as RequestInit;
        if (noCache) init.cache = "no-cache";

        ProfileOverrides = await fetch(PROFILES_URL, init).then(r => r.json());
    } catch (e) {
        new Logger("BadgeAPI").error("Failed to fetch profile overrides", e);
    }
}

// General-purpose custom badges: anyone can add themselves to docs/badges.json
// (see docs/README.md) and it shows up for every HyperCord client. Distinct from
// DonorBadges above, which is reserved for real donors and gates isDonor().
let CustomBadges = {} as Record<string, Array<Record<"tooltip" | "badge", string>>>;

const CUSTOM_BADGES_URL = "https://raw.githubusercontent.com/hypercordapp/hypercord/main/docs/badges.json";

async function loadCustomBadges(noCache = false) {
    try {
        const init = {} as RequestInit;
        if (noCache) init.cache = "no-cache";

        CustomBadges = await fetch(CUSTOM_BADGES_URL, init).then(r => r.json());
    } catch (e) {
        new Logger("BadgeAPI").error("Failed to fetch custom badges", e);
    }
}

// Callable from other plugins (e.g. FakeProfile, right after it pushes a
// change to its own badges/banner) to force an immediate refresh instead of
// waiting for the next periodic poll.
async function refetchBadges() {
    await Promise.all([loadBadges(true), loadCustomBadges(true)]);
}

let originalExtractTimestamp: typeof SnowflakeUtils.extractTimestamp | undefined;

// Discord doesn't store account creation as its own field - every "member
// since" display (including the profile popout) derives it by decoding the
// timestamp bits baked into the account's own snowflake ID via
// SnowflakeUtils.extractTimestamp(userId). FakeProfile's fakeCreatedAt
// syncs a fake date here (ProfileOverrides[userId].createdAt) the same way
// as decoration/nameplate/profileEffect/displayNameStyle - patched in this
// (required, always-on) plugin rather than FakeProfile itself so it renders
// for every HyperCord user viewing the profile, not just viewers who happen
// to also have FakeProfile enabled. Every other snowflake (messages,
// guilds, users with no override) passes through untouched.
function patchSnowflakeUtils() {
    if (originalExtractTimestamp) return;

    originalExtractTimestamp = SnowflakeUtils.extractTimestamp.bind(SnowflakeUtils);

    SnowflakeUtils.extractTimestamp = ((snowflake: string) => {
        const override = ProfileOverrides[snowflake]?.createdAt;
        if (override) {
            const date = new Date(override);
            if (!isNaN(date.getTime())) return date.getTime();
        }
        return originalExtractTimestamp!(snowflake);
    }) as typeof SnowflakeUtils.extractTimestamp;
}

function unpatchSnowflakeUtils() {
    if (originalExtractTimestamp) SnowflakeUtils.extractTimestamp = originalExtractTimestamp;
    originalExtractTimestamp = undefined;
}

let originalGetUser: typeof UserStore.getUser | undefined;
let originalGetCurrentUser: typeof UserStore.getCurrentUser | undefined;

// FakeProfile's own username/globalName override only ever applies locally
// (virtualMerge, gated to isOwnId) and only on clients that have FakeProfile
// itself enabled - fine for the profile owner's own instant preview, but a
// viewer without FakeProfile enabled never sees it, the exact same gotcha
// already fixed once for createdAt/decoration/nameplate/etc. This applies the
// SYNCED version to ANY userId, in this required/always-on plugin, so it
// renders for every HyperCord viewer regardless of their own plugin choices.
// Direct mutation of the real cached record (not a Proxy wrapper) - the same
// technique already confirmed working for decoration/nameplate overrides.
function patchIdentity() {
    if (originalGetUser) return;

    originalGetUser = UserStore.getUser.bind(UserStore);
    originalGetCurrentUser = UserStore.getCurrentUser.bind(UserStore);

    const applyIdentity = (real: any) => {
        if (!real) return real;

        const fake = ProfileOverrides[real.id]?.fakeIdentity;
        if (!fake) return real;

        if (fake.username) real.username = fake.username;
        if (fake.globalName) real.globalName = fake.globalName;
        return real;
    };

    UserStore.getUser = ((id: string) => applyIdentity(originalGetUser!(id))) as typeof UserStore.getUser;
    UserStore.getCurrentUser = (() => applyIdentity(originalGetCurrentUser!())) as typeof UserStore.getCurrentUser;
}

function unpatchIdentity() {
    if (originalGetUser) UserStore.getUser = originalGetUser;
    if (originalGetCurrentUser) UserStore.getCurrentUser = originalGetCurrentUser;
    originalGetUser = originalGetCurrentUser = undefined;
}

let intervalId: any;

// Explicit render order given directly by the user (Staff -> Partnered
// Server Owner -> HypeSquad Events -> Bug Hunter -> Early Verified Bot
// Developer -> Nitro -> Early Supporter -> Server Booster -> Moderator
// Programs Alumni -> HypeSquad Houses -> Legacy Username -> Quest -> Last
// Meadow Online -> Orbs Apprentice -> Gift Giving), not Discord's own raw
// flag-bit order. Every Nitro tier shares one slot and every Boost tier
// shares one slot (a profile only ever has ONE of each active anyway, see
// REAL_BADGE_ID_PRIORITY's comment below); same for the three HypeSquad
// Houses. Unrecognized badges land last (Unknown) rather than guessed into
// some other slot. active_developer isn't part of the requested order
// (hidden/retired) - tucked in right after Quest since nothing depends on
// exactly where a hidden badge falls.
const enum BadgePriority {
    HyperCord = 1,
    Staff = 2,
    Partner = 3,
    HypeSquadEvents = 4,
    BugHunterLevel1 = 5,
    BugHunterLevel2 = 5,
    VerifiedDeveloper = 6,
    // Every Nitro tier collapses to this one value on purpose.
    NitroOpal = 7,
    NitroRuby = 7,
    NitroEmerald = 7,
    NitroDiamond = 7,
    NitroPlatinum = 7,
    NitroGold = 7,
    NitroSilver = 7,
    NitroBronze = 7,
    Nitro = 7,
    EarlySupporter = 8,
    // Every Boost tier collapses to this one value on purpose.
    Boost24 = 9,
    Boost18 = 9,
    Boost15 = 9,
    Boost12 = 9,
    Boost9 = 9,
    Boost6 = 9,
    Boost3 = 9,
    Boost2 = 9,
    Boost1 = 9,
    CertifiedModerator = 10,
    // Every HypeSquad House collapses to this one value on purpose.
    HypeSquadBravery = 11,
    HypeSquadBrilliance = 11,
    HypeSquadBalance = 11,
    LegacyUsername = 12,
    Quest = 13,
    ActiveDeveloper = 14,
    LastMeadowOnline = 15,
    OrbsApprentice = 16,
    Unknown = 99,
    // Fake-only tier ladder (see badgeCatalog.ts's "Gift Giving" category) -
    // no real Discord badge to dedupe against, so unlike Nitro/Boost these
    // never need REAL_BADGE_ID_PRIORITY entries or isX() range helpers.
    // Shows AFTER everything above on purpose (confirmed explicitly) -
    // Legend is the top tier (shows first among the six), Patron the entry
    // tier (last of the six).
    GifterLegend = 100,
    GifterHero = 101,
    GifterIcon = 102,
    GifterLuminary = 103,
    GifterChampion = 104,
    GifterPatron = 105
}

// badgeCatalog.ts key -> priority - every catalog key gets its own explicit
// entry, no category-title fallback for Nitro/Boost anymore: each tenure
// tier is its own slot per the spec, since "which exact tier" is exactly
// what real Discord's own order distinguishes between.
const CATALOG_KEY_PRIORITY: Record<string, BadgePriority> = {
    staff: BadgePriority.Staff,
    partner: BadgePriority.Partner,
    hypesquad: BadgePriority.HypeSquadEvents,
    bug_hunter_2: BadgePriority.BugHunterLevel2,
    bug_hunter_1: BadgePriority.BugHunterLevel1,
    house_bravery: BadgePriority.HypeSquadBravery,
    house_brilliance: BadgePriority.HypeSquadBrilliance,
    house_balance: BadgePriority.HypeSquadBalance,
    early_supporter: BadgePriority.EarlySupporter,
    nitro_opal: BadgePriority.NitroOpal,
    nitro_ruby: BadgePriority.NitroRuby,
    nitro_emerald: BadgePriority.NitroEmerald,
    nitro_diamond: BadgePriority.NitroDiamond,
    nitro_platinum: BadgePriority.NitroPlatinum,
    nitro_gold: BadgePriority.NitroGold,
    nitro_silver: BadgePriority.NitroSilver,
    nitro_bronze: BadgePriority.NitroBronze,
    nitro_classic: BadgePriority.Nitro,
    boost_24: BadgePriority.Boost24,
    boost_18: BadgePriority.Boost18,
    boost_15: BadgePriority.Boost15,
    boost_12: BadgePriority.Boost12,
    boost_9: BadgePriority.Boost9,
    boost_6: BadgePriority.Boost6,
    boost_3: BadgePriority.Boost3,
    boost_2: BadgePriority.Boost2,
    boost_1: BadgePriority.Boost1,
    gifter_legend: BadgePriority.GifterLegend,
    gifter_hero: BadgePriority.GifterHero,
    gifter_icon: BadgePriority.GifterIcon,
    gifter_luminary: BadgePriority.GifterLuminary,
    gifter_champion: BadgePriority.GifterChampion,
    gifter_patron: BadgePriority.GifterPatron,
    active_developer: BadgePriority.ActiveDeveloper,
    verified_developer: BadgePriority.VerifiedDeveloper,
    quest: BadgePriority.Quest,
    certified_moderator: BadgePriority.CertifiedModerator,
    legacy_username: BadgePriority.LegacyUsername,
    last_meadow_online: BadgePriority.LastMeadowOnline,
    orbs_apprentice: BadgePriority.OrbsApprentice,
};
// Strips Object.prototype - this gets indexed by a catalogKey extracted from
// a donor badge's id (see getFakeBadgePriority below), which ultimately
// traces back to a value a user's own client PUT to badge-api's self-badges
// route. Without this, CATALOG_KEY_PRIORITY["__proto__"] (or "constructor"/
// "toString"/etc.) would resolve to a real inherited object instead of
// undefined, silently corrupting this badge's sort position instead of
// falling through to LABEL_PRIORITY as intended.
Object.setPrototypeOf(CATALOG_KEY_PRIORITY, null);

// FakeProfile's catalog (badgeCatalog.ts) is the exact, known set of labels a
// synced badge can have when it's a tier pick rather than an arbitrary donor/
// custom badge - built once from data we author ourselves, so this is an
// exact lookup instead of a locale-risky regex guess.
const LABEL_PRIORITY = new Map<string, BadgePriority>(
    BADGE_CATALOG.flatMap(category => category.badges.map(
        badge => [badge.label, CATALOG_KEY_PRIORITY[badge.key] ?? BadgePriority.Unknown] as const
    ))
);

// Discord's own real badge ids. premium_*/guild_booster_* are verified
// against a live real badge object (via a genuine Nitro+Boost account), e.g.
// { id: "premium_tenure_3_month_v2", description: "12.03.26 tarihinden beri abone" }
// and { id: "guild_booster_lvl3", description: "12 Mar 2026 tarihinden beri
// sunucu takviyesi yapıyor" } - description is server-localized and never
// contains the words "nitro"/"boost" in any locale, so id is the only stable
// field to match on. The rest below are Discord's long-standing, publicly
// documented flag-badge ids (unchanged for years), matched the same way.
// Real Nitro/Boost ids don't encode which of our 8 fake tenure tiers they'd
// correspond to (and don't need to: a profile only ever has ONE real Nitro
// and/or ONE real Boost badge at a time, never several tenures side by side,
// so any single slot within the right block sorts identically) - pinned to
// the bare/base slot of each block (Nitro, Boost1) rather than guessing a
// specific tenure tier from the id. Quest badge ids are NOT included - they
// aren't a stable/verified id shape here, so an unmatched quest badge
// deliberately falls through to Unknown rather than risking a wrong guess
// (see the HypeSquad sibling-patch incident this file already avoided once -
// _api/badges' own patch comment above).
const REAL_BADGE_ID_PRIORITY: [RegExp, BadgePriority][] = [
    [/^premium/i, BadgePriority.Nitro],
    [/^guild_booster/i, BadgePriority.Boost1],
    [/^staff$/i, BadgePriority.Staff],
    [/^partner$/i, BadgePriority.Partner],
    [/^hypesquad$/i, BadgePriority.HypeSquadEvents],
    [/^hypesquad_online_house_1/i, BadgePriority.HypeSquadBravery],
    [/^hypesquad_online_house_2/i, BadgePriority.HypeSquadBrilliance],
    [/^hypesquad_online_house_3/i, BadgePriority.HypeSquadBalance],
    [/^bug_hunter_level_2/i, BadgePriority.BugHunterLevel2],
    [/^bug_hunter_level_1/i, BadgePriority.BugHunterLevel1],
    [/^early_supporter$/i, BadgePriority.EarlySupporter],
    [/^active_developer$/i, BadgePriority.ActiveDeveloper],
    [/^verified_developer$/i, BadgePriority.VerifiedDeveloper],
    [/^certified_moderator$/i, BadgePriority.CertifiedModerator],
];

const NITRO_TIER_RANGE = [BadgePriority.NitroOpal, BadgePriority.Nitro] as const;
const BOOST_TIER_RANGE = [BadgePriority.Boost24, BadgePriority.Boost1] as const;

function isNitroTier(priority: BadgePriority) {
    return priority >= NITRO_TIER_RANGE[0] && priority <= NITRO_TIER_RANGE[1];
}

function isBoostTier(priority: BadgePriority) {
    return priority >= BOOST_TIER_RANGE[0] && priority <= BOOST_TIER_RANGE[1];
}

// hypercord_donor_badge_<catalogKey>_<idx> (see getDonorBadges) - matched
// before falling back to LABEL_PRIORITY so a localized (non-English)
// tooltip, which LABEL_PRIORITY can never match, still sorts correctly.
const DONOR_BADGE_ID_PATTERN = /^hypercord_donor_badge_(.+)_\d+$/;

function getFakeBadgePriority(badge: { id?: string; description?: string; }): BadgePriority {
    const catalogKey = DONOR_BADGE_ID_PATTERN.exec(badge.id ?? "")?.[1];
    if (catalogKey) {
        const priority = CATALOG_KEY_PRIORITY[catalogKey];
        if (priority !== undefined) return priority;
    }
    return LABEL_PRIORITY.get(badge.description ?? "") ?? BadgePriority.HyperCord;
}

function getRealBadgePriority(badge: { id: string; }): BadgePriority {
    for (const [pattern, priority] of REAL_BADGE_ID_PRIORITY) {
        if (pattern.test(badge.id)) return priority;
    }
    return BadgePriority.Unknown;
}

export function BadgeContextMenu({ badge }: { badge: Omit<ProfileBadge, "id"> & BadgeUserArgs; }) {
    return (
        <Menu.Menu
            navId="vc-badge-context"
            onClose={ContextMenuApi.closeContextMenu}
            aria-label="Badge Options"
        >
            {badge.description && (
                <Menu.MenuItem
                    id="vc-badge-copy-name"
                    label="Copy Badge Name"
                    action={() => copyWithToast(badge.description!)}
                />
            )}
            {badge.iconSrc && (
                <Menu.MenuItem
                    id="vc-badge-copy-link"
                    label="Copy Badge Image Link"
                    action={() => copyWithToast(badge.iconSrc!)}
                />
            )}
        </Menu.Menu>
    );
}

export default definePlugin({
    name: "BadgeAPI",
    description: "API to add badges to users",
    authors: [Devs.Megu, Devs.Ven, Devs.TheSun, Devs.HyperCordTeam],
    required: true,
    patches: [
        {
            find: "#{intl::PROFILE_USER_BADGES}",
            replacement: [
                {
                    match: /alt:" ","aria-hidden":!0,src:.{0,50}(\i).iconSrc/,
                    replace: "...$1.props,$&"
                },
                // Path with 2026-04-badge-discovery OFF
                {
                    match: /(?<=forceOpen:.{0,40}?ariaHidden:!0,)children:(?=.{0,50}?(\i)\.id)/,
                    replace: "children:$1.component?$self.renderBadgeComponent({...$1}):"
                },
                // Path with 2026-04-badge-discovery ON
                {
                    match: /(?<=fallbackIconSrc:.{0,50}?)children:(?=.{0,50}?(\i)\.id)/,
                    replace: "children:$1.component?$self.renderBadgeComponent({...$1}):"
                },
                // handle onClick and onContextMenu
                {
                    match: /href:(\i)\.link/,
                    replace: "...$self.getBadgeMouseEventHandlers($1),$&"
                }
            ]
        },
        {
            // Puts our badges before Discord's own real ones (real getBadges()
            // is `return[...this._userProfile.badges??[],...this._guildMemberProfile?.badges??[]]`)
            // so they read left-to-right as [platform indicator (separate
            // component, not part of this array)] -> [our HyperCord badges]
            // -> [Discord's own badges]. Verified against Discord's actual
            // live bundle before changing this, since a wrong anchor here
            // would silently drop every badge for everyone.
            find: "getLegacyUsername(){",
            replacement: {
                match: /getBadges\(\)\{return\[(.+?)\]\}getLegacyUsername/,
                replace: "getBadges(){return $self.mergeBadges($self.getBadges(this),[$1])}getLegacyUsername"
            }
        },
        // Admin-set banner overrides (from HyperCord's own backend), shown to every
        // HyperCord user viewing that profile. Same hook point as the USRBG/FakeProfile
        // plugins, just keyed by whoever's profile is being viewed instead of only self.
        {
            find: ':"SHOULD_LOAD");',
            replacement: {
                match: /\i(?:\?)?.getPreviewBanner\(\i,\i,\i\)(?=.{0,100}"COMPLETE")/,
                replace: "$self.getBannerOverride(arguments[0])||$&"
            }
        },
        // Same idea, same loading-state module, for avatar - a sibling
        // getPreviewAvatar call is expected right next to getPreviewBanner's
        // one above (Discord's profile-image loading state machine handles
        // avatar/banner/icon in parallel). If Discord ever renames/removes
        // this specific method, this patch just silently fails to match
        // (Vencord's normal safe-failure behavior for any unmatched patch)
        // rather than breaking anything - confirm live if avatar sync is
        // ever reported as "saved but not showing".
        {
            find: ':"SHOULD_LOAD");',
            replacement: {
                match: /\i(?:\?)?.getPreviewAvatar\(\i,\i,\i\)(?=.{0,100}"COMPLETE")/,
                replace: "$self.getAvatarOverride(arguments[0])||$&"
            }
        },
        // Injects a HyperCord-synced avatar decoration for WHOEVER's profile is
        // being rendered (not just self) into the same avatar-decoration-hook
        // module the Decor plugin patches. Unlike Decor (which invents its own
        // asset and needs a marker skuId + a URL-resolution hook to render it),
        // our synced value is a REAL asset/skuId captured off an actual Discord
        // user (see FakeProfile's syncAvatarDecorationToBackend) - Discord's own
        // unpatched resolution already knows how to render real cosmetic data,
        // so no extra getAvatarDecorationURL hook is needed here. Grouped: all
        // three replacements target one contiguous piece of real Discord code
        // and must all apply together, or the injected variable would be
        // either unused or referenced before its declaration.
        {
            find: "isAvatarDecorationAnimating:",
            group: true,
            replacement: [
                {
                    match: /(?<=\.avatarDecoration,guildId:\i\}\)\),)(?<=user:(\i).+?)/,
                    replace: "vcHyperCordDecoration=$self.getDecorationOverride($1?.id),"
                },
                {
                    match: /(?<={avatarDecoration:).{1,20}?(?=,)(?<=avatarDecorationOverride:(\i).+?)/,
                    replace: "$1??vcHyperCordDecoration??($&)"
                },
                {
                    match: /(?<=size:\i}\),\[)/,
                    replace: "vcHyperCordDecoration,"
                },
                // The above only swaps in the real asset/skuId - it doesn't touch
                // this sibling canAnimate default, which still reflects whatever
                // the CURRENT (faking) user's own real decoration state naturally
                // computes to (usually "no", since most people faking someone
                // else's Frame don't have a real animated one themselves). Real
                // Discord (and Decor's own getDecorAvatarDecorationURL, which
                // strips the a_ prefix when `!canAnimate`) both gate whether the
                // animated CDN asset is actually requested on this flag - without
                // forcing it, the copied Frame loads the right image but freezes
                // on frame 1 for every viewer. Same proven anchor/match shape as
                // declutter's "remove decoration" patch on this identical string.
                {
                    match: /(?<=\{avatarDecoration:.{0,40}?)(void 0!==\i\?\i:)\i(?=\)?,canAnimate:)/,
                    replace: "vcHyperCordDecoration?.asset?.startsWith(\"a_\")?!0:($&)"
                }
            ]
        }
        // Nameplate/profile effect were also tried here as a guessed sibling
        // patch (nameplateOverride/profileEffectOverride props next to
        // avatarDecorationOverride) - confirmed via a real user's console
        // ("Undoing patch group ... had no effect") that the guess was
        // wrong, so it was removed rather than left as permanent dead
        // weight/console noise. Both are instead applied via FakeProfile's
        // own UserStore/UserProfileStore/GuildMemberStore patches (direct
        // mutation), which is what's actually confirmed working.
    ],

    // for access from the console or other plugins
    get DonorBadges() {
        return ProfileOverrides;
    },

    refetchBadges,

    toolboxActions: {
        async "Refetch Badges"() {
            await refetchBadges();
            Toasts.show({
                id: Toasts.genId(),
                message: "Successfully refetched badges!",
                type: Toasts.Type.SUCCESS
            });
        }
    },

    userProfileBadge: ContributorBadge,

    async start() {
        await Promise.all([loadBadges(), loadCustomBadges()]);
        patchSnowflakeUtils();
        patchIdentity();

        clearInterval(intervalId);
        intervalId = setInterval(() => {
            loadBadges();
            loadCustomBadges();
        }, 1000 * 60 * 3); // was 30 minutes - too slow to notice someone else's newly self-added badge
    },

    async stop() {
        clearInterval(intervalId);
        unpatchSnowflakeUtils();
        unpatchIdentity();
    },

    getBadges(profile: { userId: string; guildId: string; }) {
        if (!profile) return [];

        try {
            return _getBadges(profile);
        } catch (e) {
            new Logger("BadgeAPI#getBadges").error(e);
            return [];
        }
    },

    // Single strict priority sort over the combined (fake + real) list - no
    // slicing/popping/index-guessing against either array. A picked fake
    // Nitro/Boost tier always wins over the user's real one in that same
    // category - picking a tier via FakeProfile is a deliberate choice to
    // show that instead, not alongside it, so the real badge is dropped
    // rather than the fake pick. `.sort()` is stable (guaranteed since
    // ES2019), so badges that land on the same priority keep their relative
    // order.
    mergeBadges(
        fakeBadges: ProfileBadge[],
        realBadges: Array<{ id: string; description?: string; }>
    ) {
        const hasFakeNitro = fakeBadges.some(b => isNitroTier(getFakeBadgePriority(b)));
        const hasFakeBoost = fakeBadges.some(b => isBoostTier(getFakeBadgePriority(b)));

        const dedupedRealBadges = realBadges.filter(b => {
            const priority = getRealBadgePriority(b);
            if (hasFakeNitro && isNitroTier(priority)) return false;
            if (hasFakeBoost && isBoostTier(priority)) return false;
            return true;
        });

        const combined = [
            ...fakeBadges.map(badge => ({ badge, priority: getFakeBadgePriority(badge) })),
            ...dedupedRealBadges.map(badge => ({ badge, priority: getRealBadgePriority(badge) }))
        ];

        return combined
            .sort((a, b) => a.priority - b.priority)
            .map(w => w.badge);
    },

    renderBadgeComponent: ErrorBoundary.wrap((badge: ProfileBadge & BadgeUserArgs) => {
        const Component = badge.component!;
        return <Component {...badge} />;
    }, { noop: true }),


    getBadgeMouseEventHandlers(badge: ProfileBadge & BadgeUserArgs) {
        const handlers = {} as Record<string, (e: React.MouseEvent) => void>;

        if (!badge) return handlers; // sanity check

        const { onClick, onContextMenu } = badge;

        if (onClick) handlers.onClick = e => onClick(e, badge);
        if (onContextMenu) handlers.onContextMenu = e => onContextMenu(e, badge);

        return handlers;
    },

    getDonorBadges(userId: string) {
        const nitroSince = ProfileOverrides[userId]?.nitroSince;
        const boostSince = ProfileOverrides[userId]?.boostSince;

        return ProfileOverrides[userId]?.badges?.map((badge, idx) => {
            // Re-resolve the name from the live catalog + the VIEWER's own
            // language setting, rather than trusting the tooltip string that
            // got baked in (in whatever language the badge owner had
            // selected) at sync time - see syncBadgesToBackend's comment.
            // Falls back to the raw tooltip for custom/admin badges or data
            // synced before catalogKey existed.
            const catalogEntry = badge.catalogKey ? BADGES_BY_KEY[badge.catalogKey] : undefined;
            const id = `hypercord_donor_badge_${badge.catalogKey ?? "custom"}_${idx}`;

            // Upgrades a picked Nitro tier badge to the styled hover card
            // (see NitroSinceHoverCard) when a nitro-since date is also set
            // - a plain badge like every other one below when it isn't, no
            // behavior change for anyone not using this optional field.
            const tierName = badge.catalogKey && NITRO_TIER_SHORT_NAME[badge.catalogKey];
            if (tierName && nitroSince) {
                const date = new Date(nitroSince);
                if (!isNaN(date.getTime())) {
                    // Compact numeric date, not the month-name format Boost
                    // uses - confirmed against a real captured Nitro tenure
                    // badge object ({ id: "premium_tenure_3_month_v2",
                    // description: "12.03.26 tarihinden beri abone" }, see
                    // REAL_BADGE_ID_PRIORITY's comment below) that this is
                    // Nitro's real own format, distinct from Boost's. TR
                    // zero-pads (that captured example did); EN doesn't -
                    // confirmed against a real screenshot reading "5/4/21",
                    // not "05/04/21".
                    const ddPadded = String(date.getDate()).padStart(2, "0");
                    const mmPadded = String(date.getMonth() + 1).padStart(2, "0");
                    const yy = String(date.getFullYear()).slice(-2);
                    const description = Settings.language === "tr"
                        ? `${ddPadded}.${mmPadded}.${yy} tarihinden beri abone`
                        : `Subscriber since ${date.getMonth() + 1}/${date.getDate()}/${yy}`;
                    const title = `Nitro ${Settings.language === "tr" ? tierName.tr : tierName.en}`;

                    // Card gets the real ornate art; the actual small badge
                    // shown in the tray stays on badge.badge (the plain
                    // small icon) - never the card art.
                    const cardIconSrc = NITRO_TIER_CARD_ICON[badge.catalogKey!] ?? badge.badge;
                    const tierToken = NITRO_TIER_TOKEN_NAME[badge.catalogKey!] ?? NITRO_TIER_TOKEN_NAME.nitro_diamond;

                    // Deliberately NOT `component` + our own nested <Tooltip>
                    // here (that was the first attempt) - live-debugged via
                    // CDP against the real running client and found that
                    // path renders fine but never actually opens on hover:
                    // real Discord's current badge-tray code has no
                    // `.component` handling left to react to at all in this
                    // build (dumped the actual live module source), so our
                    // Vencord-side patch for it silently does nothing here,
                    // and a manually-nested Tooltip has no working popout
                    // context to open into (confirmed by calling its own
                    // onMouseEnter directly - runs with no error, no tooltip
                    // ever mounts). Real Discord's OWN default badge path
                    // already renders a rich node as the tooltip via an
                    // internal `__unsupportedReactNodeAsText` prop fed
                    // straight from `badge.description` with no string
                    // coercion - that's the exact mechanism real tiered
                    // tenure badges use for their own card. `description` is
                    // typed as `string` on ProfileBadge, but nothing at
                    // runtime enforces that; piggybacking on this instead
                    // reuses Discord's own always-working hover/popout
                    // wiring instead of trying to reproduce it.
                    return {
                        id,
                        iconSrc: badge.badge,
                        description: (<NitroSinceHoverCard iconSrc={cardIconSrc} tierName={title} description={description} tierToken={tierToken} />) as unknown as string,
                        position: BadgePosition.START,
                        props: {
                            style: { objectFit: "cover" as const }
                        }
                    };
                }
            }

            // Same idea as the Nitro case above, minus the card - confirmed
            // against a real live screenshot that real Discord's own boost
            // tenure tooltip is just its normal small plain text, not a big
            // card, so a picked tier + a boost-since date just swaps this
            // one badge's description to the real "since <date>" wording
            // instead of the tier label. No date set -> unchanged tier label.
            // EN wording live-verified via CDP (a real account's actual
            // tooltip): "Server boosting since Nov 12, 2023" - lowercase
            // "boosting", not "Booster".
            let description = catalogEntry ? t(catalogEntry.label) : badge.tooltip;
            if (badge.catalogKey?.startsWith("boost_") && boostSince) {
                const date = new Date(boostSince);
                if (!isNaN(date.getTime())) {
                    const day = date.getDate();
                    const year = date.getFullYear();
                    description = Settings.language === "tr"
                        ? `${day} ${TR_MONTH_ABBR[date.getMonth()]} ${year} tarihinden beri sunucu takviyesi yapıyor`
                        : `Server boosting since ${EN_MONTH_ABBR[date.getMonth()]} ${day}, ${year}`;
                }
            }

            return {
                id,
                iconSrc: badge.badge,
                description,
                position: BadgePosition.START,
                // Custom badge images come from arbitrary external URLs at
                // arbitrary native resolutions/aspect ratios, unlike Discord's own
                // pre-cropped badge assets. Discord's own badge CSS class already
                // constrains the <img> box (real badges of very different native
                // sizes all render identically), so we don't need to (and
                // shouldn't guess/hardcode) a pixel size here - just fix how a
                // non-square image fills that box instead of stretching to it.
                //
                // The Gift Giving tier PNGs (docs/gifting-*.png) used to need a
                // special-cased CSS padding hack here too - they were originally
                // drawn edge-to-edge with no internal margin, unlike Discord's own
                // real badge-icons assets (measured directly: the real glyph only
                // fills the center ~60% of its canvas). That CSS-only fix wasn't
                // reliable, so the actual PNGs were re-exported with real
                // transparent canvas padding baked in (200px art centered on a
                // 330px canvas) instead - no per-badge special-casing needed here
                // anymore, they're just regular images like every other custom
                // badge now.
                props: {
                    style: { objectFit: "cover" }
                },
                onContextMenu(event, badge) {
                    ContextMenuApi.openContextMenu(event, () => <BadgeContextMenu badge={badge} />);
                },
                // Matches real Discord's own behavior for the Staff badge
                // specifically (opens discord.com/company on click) - every
                // other badge falls back to the existing "open plugin
                // settings" shortcut.
                onClick: badge.catalogKey === "staff"
                    ? () => VencordNative.native.openExternal("https://discord.com/company")
                    : () => openSettingsPage("equicord_plugins", "Plugins"),
            } satisfies ProfileBadge;
        });
    },

    getBannerOverride({ displayProfile }: any) {
        return displayProfile?.userId ? ProfileOverrides[displayProfile.userId]?.banner || undefined : undefined;
    },

    getAvatarOverride({ displayProfile }: any) {
        return displayProfile?.userId ? ProfileOverrides[displayProfile.userId]?.avatar || undefined : undefined;
    },

    getDecorationOverride(userId: string | undefined) {
        return userId ? ProfileOverrides[userId]?.decoration || undefined : undefined;
    },

    getNameplateOverride(userId: string | undefined) {
        return userId ? ProfileOverrides[userId]?.nameplate || undefined : undefined;
    },

    getProfileEffectOverride(userId: string | undefined) {
        return userId ? ProfileOverrides[userId]?.profileEffect || undefined : undefined;
    },

    getDisplayNameStyleOverride(userId: string | undefined) {
        return userId ? ProfileOverrides[userId]?.displayNameStyle || undefined : undefined;
    },

    getCreatedAtOverride(userId: string | undefined) {
        return userId ? ProfileOverrides[userId]?.createdAt || undefined : undefined;
    },

    // Rendered as a component badge (not iconSrc) so it doesn't depend on any
    // external image CDN at all - just a plain emoji character, same proven
    // approach as HyperCordBadge's own tag badge.
    getFormerUsernameBadge(userId: string): ProfileBadge | undefined {
        const history = ProfileOverrides[userId]?.formerUsername;
        if (!history?.length) return undefined;

        const cutoff = Date.now() - TWELVE_MONTHS_MS;
        const recent = history
            .filter(entry => Date.parse(entry.until) >= cutoff)
            .sort((a, b) => Date.parse(b.until) - Date.parse(a.until));
        if (!recent.length) return undefined;

        const tooltip = recent
            .map(entry => `"${entry.name}" (until ${new Date(entry.until).toLocaleDateString()})`)
            .join(", ");

        return {
            id: "hypercord_former_username_badge",
            position: BadgePosition.START,
            component: () => (
                <span
                    style={{ fontSize: 16, lineHeight: 1 }}
                    title={`Formerly known as ${tooltip}`}
                >
                    📛
                </span>
            ),
        };
    },

    getCustomBadges(userId: string) {
        return CustomBadges[userId]?.map((badge, idx) => ({
            id: `hypercord_custom_badge_${idx}`,
            iconSrc: badge.badge,
            description: badge.tooltip,
            position: BadgePosition.START,
            // Custom badge images come from arbitrary external URLs at
            // arbitrary native resolutions/aspect ratios, unlike Discord's own
            // pre-cropped badge assets. Discord's own badge CSS class already
            // constrains the <img> box (real badges of very different native
            // sizes all render identically), so we don't need to (and
            // shouldn't guess/hardcode) a pixel size here - just fix how a
            // non-square image fills that box instead of stretching to it.
            props: {
                style: { objectFit: "cover" }
            },
            onContextMenu(event, badge) {
                ContextMenuApi.openContextMenu(event, () => <BadgeContextMenu badge={badge} />);
            },
        } satisfies ProfileBadge));
    }
});
