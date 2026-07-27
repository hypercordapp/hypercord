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
import { openSettingsPage } from "@plugins/commandPalette/commands/openSettings";
import { BADGE_CATALOG } from "@plugins/fakeProfile/badgeCatalog";
import { Devs } from "@utils/constants";
import { copyWithToast } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { shouldShowContributorBadge } from "@utils/misc";
import definePlugin from "@utils/types";
import { ContextMenuApi, Menu, Toasts, UserStore } from "@webpack/common";

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
    badges: Array<Record<"tooltip" | "badge", string>>;
    banner: string | null;
    decoration: Record<string, unknown> | null;
    nameplate: Record<string, unknown> | null;
    profileEffect: Record<string, unknown> | null;
}

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

let intervalId: any;

// Discord's real, fixed render order for the achievement/subscription badges -
// every category gets its own exact slot instead of being lumped into one
// "everything else" bucket, which is what let a picked fake badge from one
// category (e.g. Early Supporter) land ahead of or behind a real badge from a
// DIFFERENT category (e.g. Partner) purely by array-concatenation order
// instead of Discord's actual category order. Unrecognized badges land last
// (Unknown) rather than guessed into some other slot.
const enum BadgePriority {
    HyperCord = 1,
    Staff = 2,
    Partner = 3,
    HypeSquadEvents = 4,
    BugHunter = 5,
    HypeSquadHouse = 6,
    EarlySupporter = 7,
    Nitro = 8,
    Boost = 9,
    ActiveDeveloper = 10,
    VerifiedDeveloper = 11,
    Quest = 12,
    Unknown = 99
}

// badgeCatalog.ts key -> priority. Deliberately keyed by catalog `key`, not
// `title` - the "General" category alone groups Staff/Partner/HypeSquad
// Events/Active Developer, which are four different real priority slots.
// Certified Moderator has no defined slot and is intentionally left out, so
// it falls through to Unknown below rather than being guessed into one.
const CATALOG_KEY_PRIORITY: Partial<Record<string, BadgePriority>> = {
    staff: BadgePriority.Staff,
    partner: BadgePriority.Partner,
    hypesquad: BadgePriority.HypeSquadEvents,
    active_developer: BadgePriority.ActiveDeveloper,
    bug_hunter_1: BadgePriority.BugHunter,
    bug_hunter_2: BadgePriority.BugHunter,
    early_supporter: BadgePriority.EarlySupporter,
    verified_developer: BadgePriority.VerifiedDeveloper,
    house_bravery: BadgePriority.HypeSquadHouse,
    house_brilliance: BadgePriority.HypeSquadHouse,
    house_balance: BadgePriority.HypeSquadHouse,
    quest: BadgePriority.Quest,
};

// FakeProfile's catalog (badgeCatalog.ts) is the exact, known set of labels a
// synced badge can have when it's a tier pick rather than an arbitrary donor/
// custom badge - built once from data we author ourselves, so this is an
// exact lookup instead of a locale-risky regex guess. Nitro/Boost aren't in
// CATALOG_KEY_PRIORITY above since every badge in those two catalog
// categories shares one priority each - cheaper to fall back on category
// title for just those two than list every tier individually.
const LABEL_PRIORITY = new Map<string, BadgePriority>(
    BADGE_CATALOG.flatMap(category => category.badges.map(badge => {
        const priority = CATALOG_KEY_PRIORITY[badge.key]
            ?? (category.title === "Nitro" ? BadgePriority.Nitro
                : category.title === "Server Boost" ? BadgePriority.Boost
                : BadgePriority.Unknown);
        return [badge.label, priority] as const;
    }))
);

// Discord's own real badge ids. premium_*/guild_booster_* are verified
// against a live real badge object (via a genuine Nitro+Boost account), e.g.
// { id: "premium_tenure_3_month_v2", description: "12.03.26 tarihinden beri abone" }
// and { id: "guild_booster_lvl3", description: "12 Mar 2026 tarihinden beri
// sunucu takviyesi yapıyor" } - description is server-localized and never
// contains the words "nitro"/"boost" in any locale, so id is the only stable
// field to match on. The rest below are Discord's long-standing, publicly
// documented flag-badge ids (unchanged for years), matched the same way.
// Quest badge ids are NOT included - they aren't a stable/verified id shape
// here, so an unmatched quest badge deliberately falls through to Unknown
// rather than risking a wrong guess (see the HypeSquad sibling-patch incident
// this file already avoided once - _api/badges' own patch comment above).
const REAL_BADGE_ID_PRIORITY: [RegExp, BadgePriority][] = [
    [/^premium/i, BadgePriority.Nitro],
    [/^guild_booster/i, BadgePriority.Boost],
    [/^staff$/i, BadgePriority.Staff],
    [/^partner$/i, BadgePriority.Partner],
    [/^hypesquad$/i, BadgePriority.HypeSquadEvents],
    [/^hypesquad_online_house/i, BadgePriority.HypeSquadHouse],
    [/^bug_hunter/i, BadgePriority.BugHunter],
    [/^early_supporter$/i, BadgePriority.EarlySupporter],
    [/^active_developer$/i, BadgePriority.ActiveDeveloper],
    [/^verified_developer$/i, BadgePriority.VerifiedDeveloper],
];

function getFakeBadgePriority(badge: { description?: string; }): BadgePriority {
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

        clearInterval(intervalId);
        intervalId = setInterval(() => {
            loadBadges();
            loadCustomBadges();
        }, 1000 * 60 * 3); // was 30 minutes - too slow to notice someone else's newly self-added badge
    },

    async stop() {
        clearInterval(intervalId);
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
    // slicing/popping/index-guessing against either array. Real badges are
    // never filtered; a fake Nitro/Boost tier pick is dropped only when the
    // user genuinely already has that real one, since showing both is a
    // contradiction and the real one is the truth. `.sort()` is stable
    // (guaranteed since ES2019), so badges that land on the same priority
    // keep their relative order.
    mergeBadges(
        fakeBadges: ProfileBadge[],
        realBadges: Array<{ id: string; description?: string; }>
    ) {
        // "Genuinely has real Nitro/Boost" is exactly what makes Discord
        // itself emit a premium_*/guild_booster_* badge here - equivalent to
        // checking premiumType/premiumGuildSince directly, without a second
        // store lookup for data this array already reflects.
        const hasRealNitro = realBadges.some(b => getRealBadgePriority(b) === BadgePriority.Nitro);
        const hasRealBoost = realBadges.some(b => getRealBadgePriority(b) === BadgePriority.Boost);

        const dedupedFakeBadges = fakeBadges.filter(b => {
            const priority = getFakeBadgePriority(b);
            if (hasRealNitro && priority === BadgePriority.Nitro) return false;
            if (hasRealBoost && priority === BadgePriority.Boost) return false;
            return true;
        });

        const combined = [
            ...dedupedFakeBadges.map(badge => ({ badge, priority: getFakeBadgePriority(badge) })),
            ...realBadges.map(badge => ({ badge, priority: getRealBadgePriority(badge) }))
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
        return ProfileOverrides[userId]?.badges?.map((badge, idx) => ({
            id: `hypercord_donor_badge_${idx}`,
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
            onClick() {
                openSettingsPage("equicord_plugins", "Plugins");
            },
        } satisfies ProfileBadge));
    },

    getBannerOverride({ displayProfile }: any) {
        return displayProfile?.userId ? ProfileOverrides[displayProfile.userId]?.banner || undefined : undefined;
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
