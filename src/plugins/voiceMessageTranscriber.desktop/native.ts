/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

// we love CORS
export async function fetchAudio(_: IpcMainInvokeEvent, url: string): Promise<Uint8Array> {
    // Native plugin IPC methods are exposed to ANY renderer script regardless
    // of call site (VencordNative.pluginHelpers.*), not just this plugin's
    // own usage above - a string-prefix check here is not a host check:
    // "https://cdn.discordapp.com".startsWith("https://cdn.discordapp.com")
    // is also true for e.g. "https://cdn.discordapp.com.evil.tld/x", which
    // would let a malicious theme/userplugin use this as an unrestricted
    // main-process fetch (no CSP applies there) to any attacker-controlled
    // host. Parse the URL and compare the actual hostname instead.
    let hostname: string;
    try {
        ({ hostname } = new URL(url));
    } catch {
        throw new Error("Unknown URL");
    }
    if (hostname !== "cdn.discordapp.com") throw new Error("Unknown URL");

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    if (!res.headers.get("Content-Type")?.startsWith("audio/")) throw new Error(`${url} is not an audio file`);
    return new Uint8Array(await res.arrayBuffer());
}
