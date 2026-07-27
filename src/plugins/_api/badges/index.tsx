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

interface ProfileOverride {
    badges: Array<Record<"tooltip" | "badge", string>>;
    banner: string | null;
    decoration: string | null;
    nameplate: string | null;
    profileEffect: string | null;
}

// Marker skuId for HyperCord-synced avatar decorations, distinct from Decor's
// own SKU_ID/RAW_SKU_ID (src/plugins/decor) so the two plugins' overrides
// never collide if both happen to be enabled. Our stored `decoration` value
// is already a full https URL (re-hosted via hypercord-badge-api's image
// cache), so unlike Decor's own CDN-relative asset hashes there's no further
// URL construction needed - same "pass the asset straight through" case as
// Decor's own RAW_SKU_ID.
const HYPERCORD_DECORATION_SKU_ID = "hypercord_decoration";

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

const enum BadgeWeight {
    /** HyperCord identity: Contributor, arbitrary-text Donor badges, Custom badges, platform indicators - nothing from BADGE_CATALOG */
    Custom = 1,
    Nitro = 2,
    Boost = 3,
    /** Every other real Discord badge (Staff, Partner, HypeSquad, Bug Hunter, Active Developer...), and any FakeProfile pick cosplaying one of those categories */
    Other = 4
}

// FakeProfile's catalog (badgeCatalog.ts) is the exact, known set of labels
// a synced badge can have when it's a tier pick rather than an arbitrary
// donor/custom badge - built once from data we author ourselves, so this is
// an exact lookup instead of a locale-risky regex guess. A picked Nitro/Boost
// tier is cosmetically standing in for that category, so it gets the same
// weight a real Nitro/Boost badge would; a picked badge from every other
// category (Early Supporter, Verified Bot Developer, HypeSquad...) likewise
// gets grouped with Discord's other real badges instead of sitting up in the
// HyperCord-identity group with the logo/donor name badges.
const CATALOG_LABEL_WEIGHT = new Map<string, BadgeWeight>(
    BADGE_CATALOG.flatMap(category => {
        const weight = category.title === "Nitro" ? BadgeWeight.Nitro
            : category.title === "Server Boost" ? BadgeWeight.Boost
            : BadgeWeight.Other;
        return category.badges.map(badge => [badge.label, weight] as const);
    })
);

// Discord's own real Nitro/Boost badges - verified against a live real badge
// object (via a genuine Nitro+Boost account), not guessed: e.g.
// { id: "premium_tenure_3_month_v2", description: "12.03.26 tarihinden beri abone" }
// and { id: "guild_booster_lvl3", description: "12 Mar 2026 tarihinden beri
// sunucu takviyesi yapıyor" }. description is server-localized to the
// viewer's Discord language and never contains the words "nitro"/"boost" in
// any locale - matching against it (as an earlier version of this did) can
// never work. id is the stable, English, un-localized field.
const REAL_NITRO_BADGE = /^premium/i;
const REAL_BOOST_BADGE = /^guild_booster/i;

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
    authors: [Devs.Megu, Devs.Ven, Devs.TheSun],
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
        // Resolves a HyperCord-synced avatar decoration into its actual image URL.
        // Same hook point/shape as the Decor plugin's own getAvatarDecorationURL
        // patch (proven working there) - short-circuits with our own asset only
        // when the marker skuId is present, otherwise falls through ($&) to
        // Discord's real resolution (including Decor's own, if that's also active).
        {
            find: "getAvatarDecorationURL:",
            replacement: {
                match: /(?<=function \i\(\i\){)(?=let{avatarDecoration)/,
                replace: "const vcHyperCordDecoration=$self.getDecorationOverrideURL(arguments[0]);if(vcHyperCordDecoration)return vcHyperCordDecoration;"
            }
        },
        // Injects a HyperCord-synced avatar decoration for WHOEVER's profile is
        // being rendered (not just self) into the same avatar-decoration-hook
        // module Decor patches. Grouped like Decor's own patch here: all three
        // replacements target one contiguous piece of real Discord code and
        // must all apply together, or the injected variable would be either
        // unused or referenced before its declaration.
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
                    replace: "$1??(vcHyperCordDecoration?{asset:vcHyperCordDecoration,skuId:$self.HYPERCORD_DECORATION_SKU_ID}:void 0)??($&)"
                },
                {
                    match: /(?<=size:\i}\),\[)/,
                    replace: "vcHyperCordDecoration,"
                }
            ]
        }
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

    // Target order: HyperCord identity -> Nitro -> Boost -> every other real
    // Discord badge (Staff, Partner, HypeSquad, Bug Hunter, Active Developer,
    // Early Supporter, Verified Bot Developer...) *and* any FakeProfile pick
    // cosplaying one of those non-Nitro/Boost categories, grouped together.
    // Built as a single weighted `.sort()` over the combined list rather than
    // splicing specific entries out of either array by index - an earlier
    // version popped the last 1-2 entries off the real badges array assuming
    // they were always Nitro/Boost, which broke as soon as Discord appended
    // anything else after them: wrong entry got grabbed, which both failed to
    // dedupe AND visibly misordered whatever it grabbed instead. `.sort()` is
    // stable (guaranteed since ES2019), so badges within the same weight keep
    // their relative order.
    mergeBadges(
        fakeBadges: ProfileBadge[],
        realBadges: Array<{ id: string; description?: string; }>
    ) {
        const hasFakeNitro = fakeBadges.some(b => CATALOG_LABEL_WEIGHT.get(b.description ?? "") === BadgeWeight.Nitro);
        const hasFakeBoost = fakeBadges.some(b => CATALOG_LABEL_WEIGHT.get(b.description ?? "") === BadgeWeight.Boost);

        // A picked fake tier wins over Discord's real badge for the same
        // category - picking a tier is a deliberate choice to show that tier
        // specifically, so it replaces the real one instead of the two
        // stacking side by side. Real badges are matched by id (see
        // REAL_NITRO_BADGE/REAL_BOOST_BADGE above for why, not description).
        const dedupedRealBadges = realBadges.filter(b => {
            if (hasFakeNitro && REAL_NITRO_BADGE.test(b.id)) return false;
            if (hasFakeBoost && REAL_BOOST_BADGE.test(b.id)) return false;
            return true;
        });

        const weighFake = (badge: { description?: string; }) => CATALOG_LABEL_WEIGHT.get(badge.description ?? "") ?? BadgeWeight.Custom;

        const weighReal = (badge: { id: string; }) => {
            if (REAL_NITRO_BADGE.test(badge.id)) return BadgeWeight.Nitro;
            if (REAL_BOOST_BADGE.test(badge.id)) return BadgeWeight.Boost;
            return BadgeWeight.Other;
        };

        const weighted = [
            ...fakeBadges.map(badge => ({ badge, weight: weighFake(badge) })),
            ...dedupedRealBadges.map(badge => ({ badge, weight: weighReal(badge) }))
        ];

        return weighted.sort((a, b) => a.weight - b.weight).map(w => w.badge);
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

    HYPERCORD_DECORATION_SKU_ID,

    getDecorationOverride(userId: string | undefined) {
        return userId ? ProfileOverrides[userId]?.decoration || undefined : undefined;
    },

    getDecorationOverrideURL({ avatarDecoration }: { avatarDecoration?: { skuId?: string; asset?: string; } | null; }) {
        if (avatarDecoration?.skuId === HYPERCORD_DECORATION_SKU_ID) return avatarDecoration.asset;
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
