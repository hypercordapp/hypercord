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

import { _getBadges, BadgePosition, BadgeUserArgs, ProfileBadge } from "@api/Badges";
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

const CONTRIBUTOR_BADGE = "https://raw.githubusercontent.com/hypercordapp/hypercord/main/docs/hcanim.png";

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

// User-specified render order (not Discord's own raw flag-bit order anymore -
// a deliberate simplified scheme): every Nitro tier shares one slot and every
// Boost tier shares one slot (a profile only ever has ONE of each active
// anyway, see REAL_BADGE_ID_PRIORITY's comment below), unlike the old
// per-tier-distinct scheme. Unrecognized badges land last (Unknown) rather
// than guessed into some other slot.
const enum BadgePriority {
    HyperCord = 1,
    Staff = 2,
    Partner = 3,
    HypeSquadEvents = 4,
    BugHunterLevel1 = 5,
    BugHunterLevel2 = 5,
    HypeSquadBravery = 6,
    HypeSquadBrilliance = 6,
    HypeSquadBalance = 6,
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
    ActiveDeveloper = 10,
    VerifiedDeveloper = 11,
    CertifiedModerator = 13,
    Unknown = 99,
    // Fake-only tier ladder (see badgeCatalog.ts's "Gift Giving" category) -
    // no real Discord badge to dedupe against, so unlike Nitro/Boost these
    // never need REAL_BADGE_ID_PRIORITY entries or isX() range helpers.
    // Shows AFTER Unknown on purpose (confirmed explicitly) - Legend is the
    // top tier (shows first among the six), Patron the entry tier (last of
    // the six).
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
    verified_developer: BadgePriority.VerifiedDeveloper,
    certified_moderator: BadgePriority.CertifiedModerator,
};

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
        return ProfileOverrides[userId]?.badges?.map((badge, idx) => {
            // Re-resolve the name from the live catalog + the VIEWER's own
            // language setting, rather than trusting the tooltip string that
            // got baked in (in whatever language the badge owner had
            // selected) at sync time - see syncBadgesToBackend's comment.
            // Falls back to the raw tooltip for custom/admin badges or data
            // synced before catalogKey existed.
            const catalogEntry = badge.catalogKey ? BADGES_BY_KEY[badge.catalogKey] : undefined;
            return {
                id: `hypercord_donor_badge_${badge.catalogKey ?? "custom"}_${idx}`,
                iconSrc: badge.badge,
                description: catalogEntry ? t(catalogEntry.label) : badge.tooltip,
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
