/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { AvatarDecoration } from "@plugins/decor";
import { getUsersDecorations } from "@plugins/decor/lib/api";
import { DECORATION_FETCH_COOLDOWN, SKU_ID } from "@plugins/decor/lib/constants";
import { debounce } from "@shared/debounce";
import { proxyLazy } from "@utils/lazy";
import { User } from "@vencord/discord-types";
import { useEffect, useState, zustandCreate } from "@webpack/common";

interface UserDecorationData {
    asset: string | null;
    fetchedAt: Date;
}

interface UsersDecorationsState {
    usersDecorations: Map<string, UserDecorationData>;
    bulkFetch: () => Promise<void>;
    fetch: (userId: string, force?: boolean) => Promise<void>;
    fetchMany: (userIds: string[]) => Promise<void>;
    get: (userId: string) => UserDecorationData | undefined;
    getAsset: (userId: string) => string | null | undefined;
    has: (userId: string) => boolean;
    set: (userId: string, decoration: string | null) => void;
}

// Kept outside the zustand store on purpose - nothing ever reads this for
// rendering (see UsersDecorationsState, no `fetchQueue` field), it's pure
// internal bookkeeping for what bulkFetch should request next. Previously
// lived in reactive store state, so every single fetch() call (i.e. every
// avatar mounting without cached decoration data - member lists, message
// authors, DM list) did a whole-store set(), and useUserDecorAvatarDecoration
// below subscribes with no selector, so EVERY currently-mounted avatar's
// listener re-ran on EVERY other avatar's mount. Scrolling a large member
// list turned into an O(n^2) storm of listener invocations. A plain Set here
// means fetch()/fetchMany() no longer touch the store at all until bulkFetch
// actually resolves (still debounced, still one set() per batch).
let fetchQueue = new Set<string>();

export const useUsersDecorationsStore = proxyLazy(() => zustandCreate((set: any, get: any) => ({
    usersDecorations: new Map<string, UserDecorationData>(),
    bulkFetch: debounce(async () => {
        if (fetchQueue.size === 0) return;

        const fetchIds = [...fetchQueue];
        fetchQueue = new Set();

        const fetchedUsersDecorations = await getUsersDecorations(fetchIds);

        const { usersDecorations } = get();
        const newUsersDecorations = new Map(usersDecorations);

        const now = new Date();
        for (const fetchId of fetchIds) {
            const newDecoration = fetchedUsersDecorations[fetchId] ?? null;
            newUsersDecorations.set(fetchId, { asset: newDecoration, fetchedAt: now });
        }

        set({ usersDecorations: newUsersDecorations });
    }),
    async fetch(userId: string, force: boolean = false) {
        const { usersDecorations, bulkFetch } = get();

        const { fetchedAt } = usersDecorations.get(userId) ?? {};
        if (fetchedAt) {
            if (!force && Date.now() - fetchedAt.getTime() < DECORATION_FETCH_COOLDOWN) return;
        }

        fetchQueue.add(userId);
        bulkFetch();
    },
    async fetchMany(userIds) {
        if (!userIds.length) return;
        const { usersDecorations, bulkFetch } = get();

        const now = Date.now();
        for (const userId of userIds) {
            const { fetchedAt } = usersDecorations.get(userId) ?? {};
            if (fetchedAt) {
                if (now - fetchedAt.getTime() < DECORATION_FETCH_COOLDOWN) continue;
            }
            fetchQueue.add(userId);
        }

        bulkFetch();
    },
    get(userId: string) { return get().usersDecorations.get(userId); },
    getAsset(userId: string) { return get().usersDecorations.get(userId)?.asset; },
    has(userId: string) { return get().usersDecorations.has(userId); },
    set(userId: string, decoration: string | null) {
        const { usersDecorations } = get();
        const newUsersDecorations = new Map(usersDecorations);

        newUsersDecorations.set(userId, { asset: decoration, fetchedAt: new Date() });
        set({ usersDecorations: newUsersDecorations });
    }
} as UsersDecorationsState)));

export function useUserDecorAvatarDecoration(user?: User): AvatarDecoration | null | undefined {
    try {
        const [decorAvatarDecoration, setDecorAvatarDecoration] = useState<string | null>(user ? useUsersDecorationsStore.getState().getAsset(user.id) ?? null : null);

        useEffect(() => {
            const destructor = (() => {
                try {
                    return useUsersDecorationsStore.subscribe(
                        state => {
                            if (!user) return;
                            const newDecorAvatarDecoration = state.getAsset(user.id);
                            if (!newDecorAvatarDecoration) return;
                            if (decorAvatarDecoration !== newDecorAvatarDecoration) setDecorAvatarDecoration(newDecorAvatarDecoration);
                        }
                    );
                } catch {
                    return () => { };
                }
            })();

            try {
                if (user) {
                    const { fetch: fetchUserDecorAvatarDecoration } = useUsersDecorationsStore.getState();
                    fetchUserDecorAvatarDecoration(user.id);
                }
            } catch { }

            return destructor;
        }, []);

        return decorAvatarDecoration ? { asset: decorAvatarDecoration, skuId: SKU_ID } : null;
    } catch (e) {
        console.error(e);
    }

    return null;
}
