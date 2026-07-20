/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { BadgePosition, BadgeUserArgs, ProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, Forms, UserProfileStore, UserStore } from "@webpack/common";
import virtualMerge from "virtual-merge";

import { BADGES_BY_KEY } from "./badgeCatalog";
import { BadgePicker } from "./BadgePicker";

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

    // Placeholder hash so Discord thinks a banner exists and renders the banner
    // slot at all; getBannerHook below swaps in the real custom URL afterwards.
    if (settings.store.fakeBannerUrl) overrides.banner = "hypercord-fake-banner";

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
            Everything this plugin changes (username, display name, Nitro badge, account
            creation date, banner, accent color, profile theme gradient, custom badges) is{" "}
            <strong>only visible to you</strong>, in your own HyperCord client. It does not
            change what other users see on your real Discord profile — that data lives on
            Discord's servers and can't be spoofed client-side. Use the "Reapply Fake Profile"
            toolbox action after changing settings while the plugin is already running.
        </Forms.FormText>
    );
}

export default definePlugin({
    name: "FakeProfile",
    description: "Locally fake your username, display name, badges, Nitro tier, banner, accent color, profile theme gradient and account creation date on your own profile — visible only to you",
    tags: ["Fun", "Appearance"],
    authors: [Devs.HyperCordTeam],
    settings,
    settingsAboutComponent: SettingsAboutComponent,

    userProfileBadge: fakeBadgeEntry,

    patches: [
        {
            find: "getUserAvatarURL:",
            replacement: {
                match: /(getUserBannerURL:)(\i),/,
                replace: "$1$self.getBannerHook($2),"
            }
        }
    ],

    getBannerHook: (original: any) => (data: { id: string; banner: string; canAnimate?: boolean; size: number; }) => {
        if (isOwnId(data.id) && settings.store.fakeBannerUrl) return settings.store.fakeBannerUrl;
        return original(data);
    },

    toolboxActions: {
        "Reapply Fake Profile"() {
            applyPremiumOverride();
        }
    },

    start() {
        patchUserStore();
        patchUserProfileStore();
        applyPremiumOverride();
    },

    stop() {
        clearPremiumOverride();
        unpatchUserStore();
        unpatchUserProfileStore();
    }
});
