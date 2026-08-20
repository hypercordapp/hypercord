/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Shared prefix any encrypted-message version starts with - used by callers
// that just need to detect "is this an encryptcord message", not parse it.
export const MARKER = "🔐HC";

// v1 (legacy): key = SHA-256(passphrase), no salt. A fast, unsalted hash is
// not a real KDF - the same digest is reused for every message from every
// user with that passphrase, so a leaked ciphertext lets an attacker
// dictionary/rainbow-table the passphrase almost as fast as hashing
// candidates, with no per-message or per-user cost. Kept here read-only so
// messages already sent under this scheme still decrypt.
const MARKER_V1 = "🔐HC1:";
async function deriveKeyLegacy(passphrase: string): Promise<CryptoKey> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(passphrase));
    return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// v2 (current): PBKDF2-HMAC-SHA256 with a random salt embedded in the
// payload and a real iteration count, matching OWASP's current PBKDF2
// guidance - makes brute-forcing a weak/short shared passphrase from a
// leaked message meaningfully more expensive, and a unique salt per message
// means precomputing one dictionary can't be reused across messages/users.
const MARKER_V2 = "🔐HC2:";
const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

async function deriveKeyV2(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: new Uint8Array(salt).buffer, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
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
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const key = await deriveKeyV2(passphrase, salt);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text))
    );

    const combined = new Uint8Array(salt.length + iv.length + ciphertext.length);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(ciphertext, salt.length + iv.length);

    return MARKER_V2 + toBase64(combined);
}

export async function decryptText(payload: string, passphrase: string): Promise<string | null> {
    try {
        if (payload.startsWith(MARKER_V2)) {
            const combined = fromBase64(payload.slice(MARKER_V2.length));
            const salt = combined.slice(0, SALT_LENGTH);
            const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
            const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

            const key = await deriveKeyV2(passphrase, salt);
            const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
            return new TextDecoder().decode(plaintext);
        }

        if (payload.startsWith(MARKER_V1)) {
            const combined = fromBase64(payload.slice(MARKER_V1.length));
            const iv = combined.slice(0, IV_LENGTH);
            const ciphertext = combined.slice(IV_LENGTH);

            const key = await deriveKeyLegacy(passphrase);
            const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
            return new TextDecoder().decode(plaintext);
        }

        return null;
    } catch {
        return null;
    }
}
