/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";
import { OAuth2AuthorizeModal, openModal, UserStore } from "@webpack/common";

const logger = new Logger("FakeProfile:BadgeAuth");
const API_BASE = "https://api.hypercord.pro";
const SECRET_KEY = "HyperCord_badgeSecret";

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

let authorizing: Promise<string | undefined> | null = null;

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
