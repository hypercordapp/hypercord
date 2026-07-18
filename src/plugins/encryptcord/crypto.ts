/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const MARKER = "🔐HC1:"; // 🔐HC1:

async function deriveKey(passphrase: string): Promise<CryptoKey> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(passphrase));
    return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
    const binary = atob(b64);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export async function encryptText(text: string, passphrase: string): Promise<string> {
    const key = await deriveKey(passphrase);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text))
    );

    const combined = new Uint8Array(iv.length + ciphertext.length);
    combined.set(iv, 0);
    combined.set(ciphertext, iv.length);

    return MARKER + toBase64(combined);
}

export async function decryptText(payload: string, passphrase: string): Promise<string | null> {
    if (!payload.startsWith(MARKER)) return null;

    try {
        const combined = fromBase64(payload.slice(MARKER.length));
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        const key = await deriveKey(passphrase);
        const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
        return new TextDecoder().decode(plaintext);
    } catch {
        return null;
    }
}
