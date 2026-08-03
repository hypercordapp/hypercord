/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";
import { OAuth2AuthorizeModal, openModal, Toasts, UserStore } from "@webpack/common";

const logger = new Logger("FakeProfile:BadgeAuth");
const API_BASE = "https://api.hypercord.pro";
const SECRET_KEY = "HyperCord_badgeSecret";
const HYPERCORD_INVITE = "https://discord.gg/hERUNb9k5b";

const getUserId = () => UserStore.getCurrentUser()?.id;

async function getSecret(): Promise<string | undefined> {
    const userId = getUserId();
    if (!userId) return undefined;

    const secrets = await DataStore.get<Record<string, string>>(SECRET_KEY) ?? {};
    return secrets[userId];
}

async function setSecret(secret: string) {
    const userId = getUserId();
    if (!userId) return;

    await DataStore.update<Record<string, string>>(SECRET_KEY, secrets => {
        secrets ??= {};
        secrets[userId] = secret;
        return secrets;
    });
}

export async function hasBadgeAuth() {
    return (await getSecret()) !== undefined;
}

// Call this if the backend ever rejects a cached secret (401) - forces the
// next getBadgeAuthHeader() call to actually re-run the OAuth flow instead of
// silently reusing a stale/invalid secret forever with no way to recover.
export async function clearBadgeAuth() {
    const userId = getUserId();
    if (!userId) return;

    await DataStore.update<Record<string, string>>(SECRET_KEY, secrets => {
        secrets ??= {};
        delete secrets[userId];
        return secrets;
    });
}

let authorizing: Promise<string | undefined> | null = null;

// syncOnConnect() (index.tsx) fires up to 7 sync calls back to back on every
// Discord launch/reconnect, each of which can reach getBadgeAuthHeader() -
// without this cache every one of them would fire its own membership request
// and, for a non-member, its own "join the server" toast at once. Cached
// briefly (not forever) so someone who joins mid-session gets re-checked
// reasonably soon instead of staying blocked for the rest of the session.
let membershipCheck: Promise<boolean> | null = null;
let membershipCheckedAt = 0;
const MEMBERSHIP_CACHE_MS = 60_000;
let lastBlockedToastAt = 0;
const BLOCKED_TOAST_COOLDOWN_MS = 5 * 60_000;

// Read-only, no auth of its own needed - just checks whether this Discord
// account is currently in the HyperCord server. Fails open (never blocks) on
// a network hiccup so a flaky connection can't lock someone out of a feature
// they're actually entitled to use.
async function isInHyperCordServer(userId: string): Promise<boolean> {
    if (membershipCheck && Date.now() - membershipCheckedAt < MEMBERSHIP_CACHE_MS) return membershipCheck;

    membershipCheckedAt = Date.now();
    membershipCheck = (async () => {
        try {
            const res = await fetch(`${API_BASE}/guild-membership/${userId}`);
            const { isMember } = await res.json();
            return isMember !== false;
        } catch (e) {
            logger.error("Failed to check HyperCord guild membership", e);
            return true;
        }
    })();

    return membershipCheck;
}

// Same in-client OAuth flow as Settings Sync (identify scope only, native
// Discord authorize modal, no browser popup) - links this Discord account to
// HyperCord's badge backend so self-added badges/banners can be proven yours
// instead of just claimed. Cached locally afterwards; only re-prompts if that
// cache is gone or the user never completed it.
export async function getBadgeAuthHeader(): Promise<string | undefined> {
    const userId = getUserId();
    if (!userId) return undefined;

    const existing = await getSecret();
    if (existing) return window.btoa(`${existing}:${userId}`);

    // Gate the very first use (before the OAuth consent modal ever opens) on
    // actually being in the HyperCord Discord server - someone who already
    // authorized once and later leaves isn't blocked here (that's enforced
    // server-side instead, see the badges route's guildWarning/wipe).
    if (!await isInHyperCordServer(userId)) {
        // syncOnConnect() calling multiple sync functions at once, or this
        // firing again on every reconnect, would otherwise repeat the exact
        // same toast in a burst - cooldown keeps it to one nudge at a time.
        if (Date.now() - lastBlockedToastAt > BLOCKED_TOAST_COOLDOWN_MS) {
            lastBlockedToastAt = Date.now();
            Toasts.show({
                id: Toasts.genId(),
                message: `Bu özelliği kullanmak için HyperCord Discord sunucusuna katılman gerekiyor: ${HYPERCORD_INVITE}`,
                type: Toasts.Type.FAILURE
            });
        }
        return undefined;
    }

    authorizing ??= authorize().finally(() => { authorizing = null; });
    const secret = await authorizing;
    return secret ? window.btoa(`${secret}:${userId}`) : undefined;
}

async function authorize(): Promise<string | undefined> {
    let clientId: string, redirectUri: string;
    try {
        const res = await fetch(`${API_BASE}/oauth/settings`);
        ({ clientId, redirectUri } = await res.json());
    } catch (e) {
        logger.error("Failed to fetch OAuth settings", e);
        return undefined;
    }

    return new Promise(resolve => {
        openModal(props => (
            <OAuth2AuthorizeModal
                {...props}
                scopes={["identify"]}
                responseType="code"
                redirectUri={redirectUri}
                permissions={0n}
                clientId={clientId}
                cancelCompletesFlow={false}
                callback={async ({ location }: any) => {
                    if (!location) return resolve(undefined);

                    try {
                        const res = await fetch(location, { headers: { Accept: "application/json" } });
                        const { secret } = await res.json();
                        if (secret) {
                            await setSecret(secret);
                            resolve(secret);
                        } else {
                            resolve(undefined);
                        }
                    } catch (e) {
                        logger.error("Failed to complete badge authorization", e);
                        resolve(undefined);
                    }
                }}
            />
        ));
    });
}
