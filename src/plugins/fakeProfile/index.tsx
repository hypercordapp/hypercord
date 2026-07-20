/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BadgePosition, BadgeUserArgs, ProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, Forms, UserStore } from "@webpack/common";
import virtualMerge from "virtual-merge";

const settings = definePluginSettings({
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
    fakeBadges: {
        type: OptionType.STRING,
        description: "Custom badges on your own profile. One per line, format: iconUrl|tooltip text",
        default: "",
        multiline: true
    }
});

function parseFakeBadges(): ProfileBadge[] {
    return settings.store.fakeBadges
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, i) => {
            const [icon, ...rest] = line.split("|");
            return {
                id: `hypercord-fake-badge-${i}`,
                iconSrc: icon.trim(),
                description: rest.join("|").trim() || "Custom Badge"
            } satisfies ProfileBadge;
        });
}

const isOwnId = (userId: string) => userId === UserStore.getCurrentUser()?.id;

const fakeBadgeEntry: ProfileBadge = {
    id: "hypercord-fake-badges",
    position: BadgePosition.START,
    shouldShow: ({ userId }: BadgeUserArgs) => isOwnId(userId) && settings.store.fakeBadges.trim().length > 0,
    getBadges: () => parseFakeBadges()
};

let originalGetUser: typeof UserStore.getUser | undefined;
let originalGetCurrentUser: typeof UserStore.getCurrentUser | undefined;
let cachedRealUser: unknown;
let cachedFakeUser: unknown;

function buildFakeUser(real: any) {
    if (!real) return real;
    if (real === cachedRealUser) return cachedFakeUser;

    const overrides: Record<string, string> = {};
    if (settings.store.fakeUsername) overrides.username = settings.store.fakeUsername;
    if (settings.store.fakeGlobalName) overrides.globalName = settings.store.fakeGlobalName;

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
            creation date, custom badges) is <strong>only visible to you</strong>, in your
            own HyperCord client. It does not change what other users see on your real
            Discord profile — that data lives on Discord's servers and can't be spoofed
            client-side. Use the "Reapply Fake Profile" toolbox action after changing
            settings while the plugin is already running.
        </Forms.FormText>
    );
}

export default definePlugin({
    name: "FakeProfile",
    description: "Locally fake your username, display name, badges, Nitro tier and account creation date on your own profile — visible only to you",
    tags: ["Fun", "Appearance"],
    authors: [Devs.HyperCordTeam],
    settings,
    settingsAboutComponent: SettingsAboutComponent,

    userProfileBadge: fakeBadgeEntry,

    toolboxActions: {
        "Reapply Fake Profile"() {
            applyPremiumOverride();
        }
    },

    start() {
        patchUserStore();
        applyPremiumOverride();
    },

    stop() {
        clearPremiumOverride();
        unpatchUserStore();
    }
});
