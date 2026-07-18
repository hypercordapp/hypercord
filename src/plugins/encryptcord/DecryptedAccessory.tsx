/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Message } from "@vencord/discord-types";
import { useEffect, useState } from "@webpack/common";

import { decryptText, MARKER } from "./crypto";
import { settings } from "./settings";

export function DecryptedAccessory({ message }: { message: Message; }) {
    const [decrypted, setDecrypted] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        if (!message.content?.startsWith(MARKER) || !settings.store.passphrase) {
            setDecrypted(undefined);
            return;
        }

        let cancelled = false;
        decryptText(message.content, settings.store.passphrase).then(result => {
            if (!cancelled) setDecrypted(result);
        });
        return () => { cancelled = true; };
    }, [message.content, settings.store.passphrase]);

    if (!message.content?.startsWith(MARKER)) return null;

    return (
        <div style={{ marginTop: 4, opacity: 0.9 }}>
            {decrypted === undefined && (
                <span style={{ color: "var(--text-muted)" }}>🔒 Encrypted message (set your passphrase to decrypt)</span>
            )}
            {decrypted === null && (
                <span style={{ color: "var(--text-danger)" }}>🔒 Encrypted message (wrong passphrase)</span>
            )}
            {typeof decrypted === "string" && (
                <span>🔓 <i>{decrypted}</i></span>
            )}
        </div>
    );
}
