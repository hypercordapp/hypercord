/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgeUserArgs, removeProfileBadge } from "@api/Badges";
import * as DataStore from "@api/DataStore";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

interface NameEntry { name: string; until: string; }
interface UserNameState { currentName: string; history: NameEntry[]; }

const STORE_KEY = "HyperCord_prevNames";
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

// In-memory mirror of the persisted DataStore map, kept in sync on every
// write, so the badge's shouldShow/component (which must stay synchronous)
// never has to await a DataStore read.
const cache = new Map<string, UserNameState>();

async function loadCache() {
    const all = await DataStore.get<Record<string, UserNameState>>(STORE_KEY) ?? {};
    for (const [id, state] of Object.entries(all)) cache.set(id, state);
}

// Unlike FakeProfile's former-username feature (self-only, backend-synced,
// shown to every viewer), this observes ANY user's real renames locally as
// your own client happens to see them via USER_UPDATE - and stays strictly
// local (DataStore only, never synced anywhere) since there's no consent to
// publish someone else's name history to other people.
async function recordUsername(userId: string, username: string) {
    if (!username) return;

    const state = cache.get(userId);
    if (!state) {
        cache.set(userId, { currentName: username, history: [] });
        return;
    }
    if (state.currentName === username) return;

    state.history.push({ name: state.currentName, until: new Date().toISOString() });
    state.currentName = username;

    const cutoff = Date.now() - TWELVE_MONTHS_MS;
    state.history = state.history.filter(e => Date.parse(e.until) >= cutoff);

    await DataStore.update<Record<string, UserNameState>>(STORE_KEY, all => {
        all ??= {};
        all[userId] = state!;
        return all;
    });
}

function onUserUpdate({ user }: any) {
    if (!user?.id || !user?.username) return;
    recordUsername(user.id, user.username);
}

function recentHistory(userId: string): NameEntry[] {
    const state = cache.get(userId);
    if (!state?.history.length) return [];

    const cutoff = Date.now() - TWELVE_MONTHS_MS;
    return state.history.filter(e => Date.parse(e.until) >= cutoff);
}

const badge = {
    id: "hypercord_prevnames_badge",
    component: ({ userId }: BadgeUserArgs) => {
        const recent = recentHistory(userId);
        if (!recent.length) return null;

        const tooltip = recent
            .map(e => `"${e.name}" (until ${new Date(e.until).toLocaleDateString()})`)
            .join(", ");

        return (
            <span
                style={{ fontSize: 14, lineHeight: 1 }}
                title={`Previously known as ${tooltip} - only visible to you, observed locally by your own client`}
            >
                🕰️
            </span>
        );
    },
    shouldShow: ({ userId }: BadgeUserArgs) => recentHistory(userId).length > 0
};

export default definePlugin({
    name: "PrevNames",
    description: "Locally remembers real username changes for any user you encounter (last 12 months) and shows a badge only you can see - never synced anywhere, purely observed from your own client's own view",
    tags: ["Utility"],
    authors: [Devs.HyperCordTeam],

    async start() {
        await loadCache();
        FluxDispatcher.subscribe("USER_UPDATE", onUserUpdate);
        addProfileBadge(badge);
    },

    stop() {
        FluxDispatcher.unsubscribe("USER_UPDATE", onUserUpdate);
        removeProfileBadge(badge);
        cache.clear();
    }
});
