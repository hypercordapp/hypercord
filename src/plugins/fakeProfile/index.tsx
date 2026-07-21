/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { BadgePosition, BadgeUserArgs, ProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, Forms, Toasts, UserProfileStore, UserStore } from "@webpack/common";
import virtualMerge from "virtual-merge";

import { getBadgeAuthHeader,hasBadgeAuth } from "./badgeAuth";
import { BADGES_BY_KEY } from "./badgeCatalog";
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

    const badges = settings.store.selectedBadges
        .map(key => BADGES_BY_KEY[key])
        .filter(Boolean)
        .map(badge => ({ badge: badge.iconSrc, tooltip: badge.label }));

    try {
        await fetch(`${SELF_PROFILES_BASE}/${userId}/badges`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: auth },
            body: JSON.stringify({ badges })
        });
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

        // 409 here just means "an admin banner is already set and your fakeBannerUrl
        // conflicts with it" - a persistent state, not a one-off error. Since this
        // same sync also runs silently on every reconnect (Discord reload/reconnect
        // fires CONNECTION_OPEN), toasting every time would spam the exact same
        // message on every refresh. Only surface it for the explicit "Reapply Fake
        // Profile" action below, where the user is actively asking for feedback.
        if (res.status === 409 && !silent) {
            Toasts.show({
                id: Toasts.genId(),
                message: "Can't sync your banner - HyperCord staff already set one for you.",
                type: Toasts.Type.FAILURE
            });
        }
    } catch (e) {
        logger.error("Failed to sync banner to HyperCord", e);
    }
}

function syncOnConnect() {
    syncBadgesToBackend();
    syncBannerToBackend(true);
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
        description: "Override your own profile banner with an image URL, shown on your own profile popout (leave empty to disable)",
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

function getFakeBadges(): ProfileBadge[] {
    return settings.store.selectedBadges
        .map(key => BADGES_BY_KEY[key])
        .filter(Boolean)
        .map((badge, i) => ({
            id: `hypercord-fake-badge-${i}`,
            iconSrc: badge.iconSrc,
            description: badge.label
        } satisfies ProfileBadge));
}

const isOwnId = (userId: string) => userId === UserStore.getCurrentUser()?.id;

const fakeBadgeEntry: ProfileBadge = {
    id: "hypercord-fake-badges",
    position: BadgePosition.START,
    shouldShow: ({ userId }: BadgeUserArgs) => isOwnId(userId) && settings.store.selectedBadges.length > 0,
    getBadges: () => getFakeBadges()
};

let originalGetUser: typeof UserStore.getUser | undefined;
let originalGetCurrentUser: typeof UserStore.getCurrentUser | undefined;
let cachedRealUser: unknown;
let cachedFakeUser: unknown;

function parseHexColor(hex: string): number | undefined {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    return match ? parseInt(match[1], 16) : undefined;
}

function buildFakeUser(real: any) {
    if (!real) return real;
    if (real === cachedRealUser) return cachedFakeUser;

    const overrides: Record<string, unknown> = {};
    if (settings.store.fakeUsername) overrides.username = settings.store.fakeUsername;
    if (settings.store.fakeGlobalName) overrides.globalName = settings.store.fakeGlobalName;

    if (settings.store.fakeAccentColor) {
        const color = parseHexColor(settings.store.fakeAccentColor);
        if (color !== undefined) overrides.accentColor = color;
    }

    cachedRealUser = real;
    cachedFakeUser = Object.keys(overrides).length ? virtualMerge(real, overrides) : real;
    return cachedFakeUser;
}

function patchUserStore() {
    if (originalGetUser) return;

    originalGetUser = UserStore.getUser.bind(UserStore);
    originalGetCurrentUser = UserStore.getCurrentUser.bind(UserStore);

    UserStore.getUser = ((id: string) => {
        const real = originalGetUser!(id);
        if (!real || !isOwnId(id)) return real;
        return buildFakeUser(real);
    }) as typeof UserStore.getUser;

    UserStore.getCurrentUser = (() => buildFakeUser(originalGetCurrentUser!())) as typeof UserStore.getCurrentUser;
}

function unpatchUserStore() {
    if (originalGetUser) UserStore.getUser = originalGetUser;
    if (originalGetCurrentUser) UserStore.getCurrentUser = originalGetCurrentUser;
    originalGetUser = originalGetCurrentUser = undefined;
    cachedRealUser = cachedFakeUser = undefined;
}

let originalGetUserProfile: typeof UserProfileStore.getUserProfile | undefined;

function patchUserProfileStore() {
    if (originalGetUserProfile) return;

    originalGetUserProfile = UserProfileStore.getUserProfile.bind(UserProfileStore);

    UserProfileStore.getUserProfile = ((id: string) => {
        const profile = originalGetUserProfile!(id);
        if (!profile || !isOwnId(id)) return profile;

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

        return profile;
    }) as typeof UserProfileStore.getUserProfile;
}

function unpatchUserProfileStore() {
    if (originalGetUserProfile) UserProfileStore.getUserProfile = originalGetUserProfile;
    originalGetUserProfile = undefined;
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
            <strong>Your selected badges and banner are different: they're synced to
                HyperCord's own backend and shown to every HyperCord user viewing your
                profile</strong>, not just you. The first time you pick a badge or set a
            banner, you'll get a one-time in-app Discord authorization prompt (identify
            scope only) proving the account is really yours. Use the "Reapply Fake
            Profile" toolbox action after changing settings while the plugin is already
            running to force a resync.
        </Forms.FormText>
    );
}

export default definePlugin({
    name: "FakeProfile",
    description: "Locally fake your username, display name, Nitro tier, accent color and profile theme gradient on your own profile (visible only to you) — badges and banner sync to HyperCord's backend and show for every HyperCord user viewing your profile",
    tags: ["Fun", "Appearance"],
    authors: [Devs.HyperCordTeam],
    settings,
    settingsAboutComponent: SettingsAboutComponent,

    userProfileBadge: fakeBadgeEntry,

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
            await Promise.all([syncBadgesToBackend(), syncBannerToBackend()]);
            Toasts.show({
                id: Toasts.genId(),
                message: "Synced badges and banner to HyperCord!",
                type: Toasts.Type.SUCCESS
            });
        }
    },

    start() {
        patchUserStore();
        patchUserProfileStore();
        applyPremiumOverride();

        syncOnConnect();
        FluxDispatcher.subscribe("CONNECTION_OPEN", syncOnConnect);
    },

    stop() {
        FluxDispatcher.unsubscribe("CONNECTION_OPEN", syncOnConnect);
        clearPremiumOverride();
        unpatchUserStore();
        unpatchUserProfileStore();
    }
});
