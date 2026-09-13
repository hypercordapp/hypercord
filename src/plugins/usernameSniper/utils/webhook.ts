/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export async function sendWebhookAlert(webhookUrl: string, payload: {
    username: string;
    claimed: boolean;
    tier: string;
    mode: string;
    timestamp: number;
    extraMessage?: string;
}): Promise<boolean> {
    if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
        return false;
    }

    try {
        const title = payload.claimed
            ? `🎉 [HyperCord Sniper] KULLANICI ADI HESABINA ALINDI: @${payload.username}`
            : `🎯 [HyperCord Sniper] BOŞTA KULLANICI ADI BULUNDU: @${payload.username}`;

        const color = payload.claimed ? 0x00FF88 : 0x00D9FF; // Green for claimed, Cyan for available

        const body = {
            embeds: [
                {
                    title,
                    description: payload.claimed
                        ? `👑 **Tebrikler!** @${payload.username} kullanıcı adı başarıyla hesabınıza geçirildi.`
                        : `✨ **@${payload.username}** şu anda boşta! Hemen Discord üzerinden talep edebilirsiniz.`,
                    color,
                    fields: [
                        { name: "Kullanıcı Adı", value: `\`${payload.username}\``, inline: true },
                        { name: "Paket Seviyesi", value: `\`${payload.tier.toUpperCase()}\``, inline: true },
                        { name: "Tarama Modu", value: `\`${payload.mode}\``, inline: true },
                        { name: "Zaman", value: `<t:${Math.floor(payload.timestamp / 1000)}:R>`, inline: true },
                    ],
                    footer: {
                        text: "HyperCord Pomelo Sniper Studio • DevBuild",
                    },
                    timestamp: new Date(payload.timestamp).toISOString(),
                },
            ],
        };

        const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        return res.ok;
    } catch {
        return false;
    }
}
