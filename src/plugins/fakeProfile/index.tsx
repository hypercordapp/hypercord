/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import BadgeAPIPlugin from "@plugins/_api/badges";
import { Devs } from "@utils/constants";
import { fetchUserProfile } from "@utils/discord";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, Forms, GuildMemberStore, Toasts, UserProfileStore, UserStore } from "@webpack/common";
import virtualMerge from "virtual-merge";

import { clearBadgeAuth, getBadgeAuthHeader, hasBadgeAuth } from "./badgeAuth";
import { BADGES_BY_KEY, sortByDisplayOrder } from "./badgeCatalog";
import { BadgePicker } from "./BadgePicker";

const logger = new Logger("FakeProfile");
const SELF_PROFILES_BASE = "https://api.hypercord.pro/self/profiles";

// Pushes your selected badges/banner to HyperCord's own backend so every
// HyperCord user viewing your profile sees them too, not just you. Requires
// proof (via badgeAuth's OAuth-verified secret) that you actually are the
// Discord account being synced - see hypercord-badge-api's /self routes.
//
// One atomic PUT of the full list, not "delete everything then re-add one by
// one" - the old approach raced when two syncs overlapped (a Discord reload
// fires this once immediately on plugin start and again on the reconnect's
// CONNECTION_OPEN, close enough together to interleave) and produced
// duplicate badges.
export async function syncBadgesToBackend() {
    const userId = UserStore.getCurrentUser()?.id;
    if (!userId) return;

    // Don't force an OAuth prompt just to sync an empty list for someone who's
    // never used this feature - only authorize if there's actually something
    // to push, or we already know they're authorized (e.g. clearing a
    // previous selection).
    if (settings.store.selectedBadges.length === 0 && !await hasBadgeAuth()) return;

    const auth = await getBadgeAuthHeader();
    if (!auth) return;

    // Sorted to match real Discord's badge order, not whatever order they
    // happened to get picked in the UI - otherwise e.g. picking Nitro before
    // HypeSquad would show Nitro first, which real Discord never does.
    const badges = sortByDisplayOrder(settings.store.selectedBadges)
        .map(key => BADGES_BY_KEY[key])
        .filter(Boolean)
        .map(badge => ({ badge: badge.iconSrc, tooltip: badge.label }));

    try {
        await fetch(`${SELF_PROFILES_BASE}/${userId}/badges`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: auth },
            body: JSON.stringify({ badges })
        });
        // Force an immediate cache refresh instead of waiting for BadgeAPI's
        // periodic poll - this is also what makes it safe to *not* have a
        // separate local-only preview of your own selection: without this,
        // FakeProfile used to register its own userProfileBadge for instant
        // feedback, but that meant your own profile rendered the badge twice
        // (once from that local echo, once from the synced version everyone
        // else sees) as soon as the backend sync actually landed.
        await BadgeAPIPlugin.refetchBadges();
    } catch (e) {
        logger.error("Failed to sync badges to HyperCord", e);
    }
}

export async function syncBannerToBackend(silent = false) {
    const userId = UserStore.getCurrentUser()?.id;
    if (!userId) return;

    if (!settings.store.fakeBannerUrl && !await hasBadgeAuth()) return;

    const auth = await getBadgeAuthHeader();
    if (!auth) return;

    try {
        const res = await fetch(`${SELF_PROFILES_BASE}/${userId}/banner`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: auth },
            body: JSON.stringify({ url: settings.store.fakeBannerUrl || null })
        });

        if (res.status === 409 && !silent) {
            Toasts.show({
                id: Toasts.genId(),
                message: "Can't sync your banner - HyperCord staff already set one for you.",
                type: Toasts.Type.FAILURE
            });
        } else if (res.ok) {
            await BadgeAPIPlugin.refetchBadges();
        }
    } catch (e) {
        logger.error("Failed to sync banner to HyperCord", e);
    }
}

// Avatar decoration/nameplate/profile effect aren't a URL we host ourselves -
// they're REAL Discord cosmetics, captured live off another real user's
// profile (identified by Discord user ID) via fetchUserProfile, then synced
// as-is. Because it's genuinely real asset/skuId data, Discord's own
// (unpatched) rendering resolves it correctly for whoever views the profile -
// no custom image hosting or URL construction needed, unlike banner above.
async function syncCosmeticFromUser(
    routeSegment: string,
    sourceUserId: string,
    noun: string,
    silent: boolean,
    extract: (sourceId: string) => Record<string, unknown> | null | undefined
) {
    const userId = UserStore.getCurrentUser()?.id;
    if (!userId) return;

    if (!sourceUserId && !await hasBadgeAuth()) return;

    let data: Record<string, unknown> | null = null;
    if (sourceUserId) {
        try {
            await fetchUserProfile(sourceUserId);
        } catch (e) {
            logger.error(`Failed to fetch source profile for ${noun}`, e);
        }
        data = extract(sourceUserId) ?? null;
        // TEMPORARY diagnostic - remove once cross-viewer decoration/
        // nameplate is confirmed working.
        logger.info(`syncCosmeticFromUser extract for ${noun}`, { sourceUserId, data });
    }

    const auth = await getBadgeAuthHeader();
    if (!auth) {
        // Silent failure here used to be indistinguishable from "nothing to
        // sync" - if the one-time Discord authorization popup gets dismissed
        // or fails, nothing ever reaches the backend and there was no
        // feedback at all telling the user why. Always surface this one,
        // even when `silent` (background reconnect syncs) - it only fires
        // when there's actually something to sync and auth genuinely failed,
        // not on every reconnect.
        if (sourceUserId) {
            Toasts.show({
                id: Toasts.genId(),
                message: `Couldn't verify your Discord identity to sync your ${noun} - a HyperCord authorization popup should have appeared, complete it and try again.`,
                type: Toasts.Type.FAILURE
            });
        }
        return;
    }

    try {
        const res = await fetch(`${SELF_PROFILES_BASE}/${userId}/${routeSegment}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: auth },
            body: JSON.stringify({ data })
        });

        // 409 here just means "an admin already set one of these for you and it
        // conflicts" - a persistent state, not a one-off error. Since this same
        // sync also runs silently on every reconnect (Discord reload/reconnect
        // fires CONNECTION_OPEN), toasting every time would spam the exact same
        // message on every refresh. Only surface it for the explicit "Reapply
        // Fake Profile" action below, where the user is actively asking for
        // feedback.
        if (res.status === 409 && !silent) {
            Toasts.show({
                id: Toasts.genId(),
                message: `Can't sync your ${noun} - HyperCord staff already set one for you.`,
                type: Toasts.Type.FAILURE
            });
        } else if (res.status === 400 && !silent) {
            Toasts.show({
                id: Toasts.genId(),
                message: `That user doesn't have a real ${noun} to copy - double check the ID.`,
                type: Toasts.Type.FAILURE
            });
        } else if (res.status === 401) {
            // The cached secret (shared across badges/banner/decoration/
            // nameplate/profile effect) is stale/invalid - clear it so the
            // NEXT sync attempt actually re-triggers the Discord
            // authorization popup instead of silently reusing the same bad
            // secret forever. This used to be a dead end with zero feedback.
            await clearBadgeAuth();
            if (!silent) {
                Toasts.show({
                    id: Toasts.genId(),
                    message: `Couldn't sync your ${noun} - your HyperCord authorization expired, try again to re-authorize.`,
                    type: Toasts.Type.FAILURE
                });
            }
        } else if (!res.ok && !silent) {
            Toasts.show({
                id: Toasts.genId(),
                message: `Couldn't sync your ${noun} to HyperCord (error ${res.status}).`,
                type: Toasts.Type.FAILURE
            });
        } else if (res.ok) {
            await BadgeAPIPlugin.refetchBadges();
        }
    } catch (e) {
        logger.error(`Failed to sync ${noun} to HyperCord`, e);
    }
}

// Each cosmetic copies from its OWN independent source user - a different
// friend per cosmetic, not one ID for all three.
export function syncAvatarDecorationToBackend(silent = false) {
    return syncCosmeticFromUser(
        "decoration",
        settings.store.fakeAvatarDecorationFromUserId,
        "avatar decoration",
        silent,
        id => (UserStore.getUser(id) as any)?.avatarDecorationData
    );
}

export function syncNameplateToBackend(silent = false) {
    return syncCosmeticFromUser(
        "nameplate",
        settings.store.fakeNameplateFromUserId,
        "nameplate",
        silent,
        id => (UserStore.getUser(id) as any)?.collectibles?.nameplate
    );
}

export function syncProfileEffectToBackend(silent = false) {
    return syncCosmeticFromUser(
        "profile-effect",
        settings.store.fakeProfileEffectFromUserId,
        "profile effect",
        silent,
        id => (UserProfileStore.getUserProfile(id) as any)?.profileEffect
    );
}

export function syncAllCosmeticsFromUser(silent = false) {
    return Promise.all([
        syncAvatarDecorationToBackend(silent),
        syncNameplateToBackend(silent),
        syncProfileEffectToBackend(silent)
    ]);
}

function syncOnConnect() {
    syncBadgesToBackend();
    syncBannerToBackend(true);
    syncAllCosmeticsFromUser(true);
}

export const settings = definePluginSettings({
    fakeUsername: {
        type: OptionType.STRING,
        description: "Override your own username across your own client (leave empty to disable)",
        default: ""
    },
    fakeGlobalName: {
        type: OptionType.STRING,
        description: "Override your own display name across your own client (leave empty to disable)",
        default: ""
    },
    fakeNitroType: {
        type: OptionType.SELECT,
        description: "Fake Nitro tier shown on your own profile popout",
        options: [
            { label: "Off (don't override)", value: -1, default: true },
            { label: "None", value: 0 },
            { label: "Nitro Basic", value: 3 },
            { label: "Nitro Classic", value: 1 },
            { label: "Nitro", value: 2 },
        ]
    },
    fakeCreatedAt: {
        type: OptionType.STRING,
        description: "Override the account creation date on your own profile popout, format YYYY-MM-DD (leave empty to disable)",
        default: ""
    },
    fakeBannerUrl: {
        type: OptionType.STRING,
        description: "Override your own profile banner with an image URL, synced to HyperCord's backend and shown to every HyperCord user viewing your profile (leave empty to disable)",
        default: ""
    },
    fakeAvatarDecorationFromUserId: {
        type: OptionType.STRING,
        displayName: "Avatar Decoration (Frame)",
        description: "Copy this Discord user's REAL avatar decoration - the ring/frame around their round avatar, what Discord's own settings now label \"Frame\" under Profile Effect & Frame - onto your own profile (Discord user ID, they need to actually have one equipped). Synced to HyperCord's backend (leave empty to disable)",
        default: ""
    },
    fakeNameplateFromUserId: {
        type: OptionType.STRING,
        displayName: "Nameplate",
        description: "Copy this Discord user's REAL nameplate - the colored/patterned strip behind their username - onto your own profile (Discord user ID, they need to actually have one equipped). Synced to HyperCord's backend (leave empty to disable)",
        default: ""
    },
    fakeProfileEffectFromUserId: {
        type: OptionType.STRING,
        displayName: "Profile Effect",
        description: "Copy this Discord user's REAL profile effect - the animated effect covering their whole profile card - onto your own profile (Discord user ID, they need to actually have one equipped). Distinct from the Frame above. Synced to HyperCord's backend (leave empty to disable)",
        default: ""
    },
    fakeAccentColor: {
        type: OptionType.STRING,
        description: "Override your own profile accent color, hex like #5865F2 (leave empty to disable)",
        default: ""
    },
    fakeThemeColorPrimary: {
        type: OptionType.STRING,
        description: "Primary color of your own profile's two-tone theme gradient, hex like #5865F2 (leave empty to disable)",
        default: ""
    },
    fakeThemeColorSecondary: {
        type: OptionType.STRING,
        description: "Secondary color of your own profile's two-tone theme gradient, hex like #EB459E (requires the primary color above to also be set)",
        default: ""
    },
    selectedBadges: {
        type: OptionType.COMPONENT,
        default: [] as string[],
        component: BadgePicker
    }
});

let originalGetUser: typeof UserStore.getUser | undefined;
let originalGetCurrentUser: typeof UserStore.getCurrentUser | undefined;

// Must go through the ORIGINAL unpatched getCurrentUser, never the patched
// UserStore.getCurrentUser - that one calls buildFakeUser, which (for the
// current user) calls isOwnId, which would call the patched
// getCurrentUser again - unbounded recursion/stack overflow. This bit
// FakeProfile in production once already, don't reintroduce it.
const isOwnId = (userId: string) => userId === (originalGetCurrentUser ?? UserStore.getCurrentUser.bind(UserStore))()?.id;
let fakeUserCache = new WeakMap<object, unknown>();

function parseHexColor(hex: string): number | undefined {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    return match ? parseInt(match[1], 16) : undefined;
}

// Decoration/nameplate applies to ANY user with synced HyperCord data, not
// just yourself - shown to every HyperCord user viewing that profile, same
// as badges/banner already are. Applied by directly mutating the raw fields
// (avatarDecorationData/collectibles) on the actual cached Discord Record
// itself, NOT via virtualMerge's Proxy wrapper - confirmed by testing that
// Profile Effect (which already used this same direct-mutation approach on
// the UserProfileStore object) shows up for other viewers, while Frame/
// Nameplate (previously done via virtualMerge, a separate Proxy object)
// did not. Discord's own `.avatarDecoration`/`.nameplate` getters read off
// `this.avatarDecorationData`/`this.collectibles` - mutating those raw
// fields in place means the getters reflect the change naturally, without
// needing the Proxy-receiver trick virtualMerge relies on.
function applyCosmeticOverrides(real: any) {
    const decorationOverride = BadgeAPIPlugin.getDecorationOverride(real.id);
    if (decorationOverride) real.avatarDecorationData = decorationOverride;

    const nameplateOverride = BadgeAPIPlugin.getNameplateOverride(real.id);
    if (nameplateOverride) real.collectibles = { ...(real.collectibles ?? {}), nameplate: nameplateOverride };

    // TEMPORARY diagnostic - remove once cross-viewer decoration/nameplate is
    // confirmed working. Only logs when there's actually a synced override to
    // report, so this stays silent for the 99% of users with nothing synced.
    if (decorationOverride || nameplateOverride) {
        logger.info("applyCosmeticOverrides", {
            userId: real.id,
            decorationOverride,
            nameplateOverride,
            realAvatarDecorationDataAfter: real.avatarDecorationData,
            realCollectiblesAfter: real.collectibles
        });
    }
}

function buildFakeUser(real: any) {
    if (!real) return real;

    applyCosmeticOverrides(real);

    // Username/globalName/accentColor stay self-only fakes via virtualMerge
    // (non-mutating) - these aren't backend-synced and would be actively
    // wrong to show for someone else's account.
    if (!isOwnId(real.id)) return real;

    const cached = fakeUserCache.get(real);
    if (cached !== undefined) return cached;

    const overrides: Record<string, unknown> = {};
    if (settings.store.fakeUsername) overrides.username = settings.store.fakeUsername;
    if (settings.store.fakeGlobalName) overrides.globalName = settings.store.fakeGlobalName;

    if (settings.store.fakeAccentColor) {
        const color = parseHexColor(settings.store.fakeAccentColor);
        if (color !== undefined) overrides.accentColor = color;
    }

    const fake = Object.keys(overrides).length ? virtualMerge(real, overrides) : real;
    fakeUserCache.set(real, fake);
    return fake;
}

function patchUserStore() {
    if (originalGetUser) return;

    originalGetUser = UserStore.getUser.bind(UserStore);
    originalGetCurrentUser = UserStore.getCurrentUser.bind(UserStore);

    // No isOwnId gate here anymore - decoration/nameplate need to apply to
    // whoever's profile is being viewed, not just your own account.
    UserStore.getUser = ((id: string) => buildFakeUser(originalGetUser!(id))) as typeof UserStore.getUser;

    UserStore.getCurrentUser = (() => buildFakeUser(originalGetCurrentUser!())) as typeof UserStore.getCurrentUser;
}

function unpatchUserStore() {
    if (originalGetUser) UserStore.getUser = originalGetUser;
    if (originalGetCurrentUser) UserStore.getCurrentUser = originalGetCurrentUser;
    originalGetUser = originalGetCurrentUser = undefined;
    fakeUserCache = new WeakMap();
}

let originalGetUserProfile: typeof UserProfileStore.getUserProfile | undefined;

function patchUserProfileStore() {
    if (originalGetUserProfile) return;

    originalGetUserProfile = UserProfileStore.getUserProfile.bind(UserProfileStore);

    UserProfileStore.getUserProfile = ((id: string) => {
        const profile = originalGetUserProfile!(id);
        if (!profile) return profile;

        if (isOwnId(id)) {
            const { fakeAccentColor, fakeThemeColorPrimary, fakeThemeColorSecondary } = settings.store;

            if (fakeAccentColor) {
                const color = parseHexColor(fakeAccentColor);
                if (color !== undefined) profile.accentColor = color;
            }

            if (fakeThemeColorPrimary) {
                const primary = parseHexColor(fakeThemeColorPrimary);
                const secondary = parseHexColor(fakeThemeColorSecondary) ?? primary;
                if (primary !== undefined && secondary !== undefined) profile.themeColors = [primary, secondary];
            }
        }

        // Profile effect applies to ANY user with synced HyperCord data, same
        // as decoration/nameplate - not gated to isOwnId.
        const profileEffectOverride = BadgeAPIPlugin.getProfileEffectOverride(id);
        if (profileEffectOverride) profile.profileEffect = profileEffectOverride as any;

        return profile;
    }) as typeof UserProfileStore.getUserProfile;
}

function unpatchUserProfileStore() {
    if (originalGetUserProfile) UserProfileStore.getUserProfile = originalGetUserProfile;
    originalGetUserProfile = undefined;
}

let originalGetMember: typeof GuildMemberStore.getMember | undefined;

// Nameplate inside a server's member list/popout reads from GuildMemberStore
// (per-guild collectibles), NOT UserStore - confirmed by profileSets' own
// getCurrentProfile, which explicitly branches `isGuildProfile ? guildMember
// : user` just for nameplate (every other field reads the same way in both
// contexts). Without this, the buildFakeUser override above only ever shows
// up in the DM sidebar / global profile, never when viewing yourself in an
// actual server, which is the more common case. Not gated to isOwnId either -
// applies to any guild member with synced HyperCord data.
function patchGuildMemberStore() {
    if (originalGetMember) return;

    originalGetMember = GuildMemberStore.getMember.bind(GuildMemberStore);

    GuildMemberStore.getMember = ((guildId: string, userId: string) => {
        const member = originalGetMember!(guildId, userId);
        if (!member) return member;

        const decorationOverride = BadgeAPIPlugin.getDecorationOverride(userId);
        if (decorationOverride) {
            (member as any).avatarDecoration = decorationOverride;
        }

        const nameplateOverride = BadgeAPIPlugin.getNameplateOverride(userId);
        if (nameplateOverride) {
            (member as any).collectibles = { ...((member as any).collectibles ?? {}), nameplate: nameplateOverride };
        }

        return member;
    }) as typeof GuildMemberStore.getMember;
}

function unpatchGuildMemberStore() {
    if (originalGetMember) GuildMemberStore.getMember = originalGetMember;
    originalGetMember = undefined;
}

// Discord's own internal "preview" override store for the profile popout.
// Best-effort: only visible to you, never sent to Discord or other users.
function applyPremiumOverride() {
    const { fakeNitroType, fakeCreatedAt } = settings.store;

    const payload: Record<string, unknown> = { type: "SET_PREMIUM_TYPE_OVERRIDE" };

    if (fakeNitroType !== -1) payload.premiumType = fakeNitroType;

    if (fakeCreatedAt) {
        const date = new Date(fakeCreatedAt);
        if (!isNaN(date.getTime())) payload.createdAt = date;
    }

    FluxDispatcher.dispatch(payload as any);
}

function clearPremiumOverride() {
    FluxDispatcher.dispatch({
        type: "SET_PREMIUM_TYPE_OVERRIDE",
        premiumType: undefined,
        createdAt: undefined
    } as any);
}

function SettingsAboutComponent() {
    return (
        <Forms.FormText>
            Username, display name, Nitro badge, account creation date, accent color and
            profile theme gradient are <strong>only visible to you</strong>, in your own
            HyperCord client — that data lives on Discord's servers and can't be spoofed
            client-side for other people.{" "}
            <strong>Your selected badges, banner, Frame, Nameplate and Profile Effect
                are different: they're synced to HyperCord's own backend and shown to
                every HyperCord user viewing your profile</strong>, not just you - each
            of Frame/Nameplate/Profile Effect copies from its own independent Discord
            user ID (they're three separate real Discord cosmetics, a different friend
            per cosmetic if you want). The first time you pick a badge or set a
            banner/decoration, you'll get a one-time in-app Discord authorization prompt
            (identify scope only) proving the account is really yours. Use the "Reapply
            Fake Profile" toolbox action after changing settings while the plugin is
            already running to force a resync.
        </Forms.FormText>
    );
}

export default definePlugin({
    name: "FakeProfile",
    description: "Locally fake your username, display name, Nitro tier, accent color and profile theme gradient on your own profile (visible only to you) — badges, banner, Frame (avatar decoration), Nameplate and Profile Effect sync to HyperCord's backend and show for every HyperCord user viewing your profile",
    tags: ["Fun", "Appearance"],
    authors: [Devs.HyperCordTeam],
    settings,
    settingsAboutComponent: SettingsAboutComponent,

    // Same proven approach as the USRBG plugin (which already ships custom banners
    // for users without Nitro): hook getPreviewBanner's call site rather than the
    // avatar/banner URL builders, since those aren't reliably invoked when there's
    // no real banner hash to begin with.
    patches: [
        {
            find: ':"SHOULD_LOAD");',
            replacement: {
                match: /\i(?:\?)?.getPreviewBanner\(\i,\i,\i\)(?=.{0,100}"COMPLETE")/,
                replace: "$self.getBannerHook(arguments[0])||$&"
            }
        }
    ],

    getBannerHook({ displayProfile }: any) {
        if (displayProfile?.userId && isOwnId(displayProfile.userId) && settings.store.fakeBannerUrl) {
            return settings.store.fakeBannerUrl;
        }
    },

    toolboxActions: {
        async "Reapply Fake Profile"() {
            applyPremiumOverride();
            await Promise.all([
                syncBadgesToBackend(),
                syncBannerToBackend(),
                syncAllCosmeticsFromUser()
            ]);
            Toasts.show({
                id: Toasts.genId(),
                message: "Synced badges, banner, avatar decoration, nameplate and profile effect to HyperCord!",
                type: Toasts.Type.SUCCESS
            });
        }
    },

    start() {
        patchUserStore();
        patchUserProfileStore();
        patchGuildMemberStore();
        applyPremiumOverride();

        syncOnConnect();
        FluxDispatcher.subscribe("CONNECTION_OPEN", syncOnConnect);
    },

    stop() {
        FluxDispatcher.unsubscribe("CONNECTION_OPEN", syncOnConnect);
        clearPremiumOverride();
        unpatchUserStore();
        unpatchUserProfileStore();
        unpatchGuildMemberStore();
    }
});
