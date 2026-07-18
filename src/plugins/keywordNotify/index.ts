/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, FluxDispatcher, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    keywords: {
        type: OptionType.STRING,
        description: "Comma-separated list of keywords to get notified about, even without a mention",
        default: ""
    },
    ignoreSelf: {
        type: OptionType.BOOLEAN,
        description: "Ignore your own messages",
        default: true
    }
});

function getKeywords(): string[] {
    return settings.store.keywords
        .split(",")
        .map(w => w.trim().toLowerCase())
        .filter(Boolean);
}

function onMessageCreate({ message }: any) {
    try {
        const keywords = getKeywords();
        if (!keywords.length || !message?.content) return;

        const self = UserStore.getCurrentUser();
        if (settings.store.ignoreSelf && message.author?.id === self?.id) return;

        const lower = message.content.toLowerCase();
        const matched = keywords.find(k => lower.includes(k));
        if (!matched) return;

        const channel = ChannelStore.getChannel(message.channelId);

        showNotification({
            title: `Keyword "${matched}" mentioned by ${message.author?.username ?? "someone"}`,
            body: message.content.length > 150 ? message.content.slice(0, 150) + "..." : message.content,
            icon: message.author?.getAvatarURL?.(),
            onClick: () => channel && FluxDispatcher.dispatch({ type: "CHANNEL_SELECT", channelId: channel.id, guildId: channel.guild_id })
        });
    } catch { }
}

export default definePlugin({
    name: "KeywordNotify",
    description: "Sends a desktop notification whenever a message contains one of your configured keywords",
    tags: ["Chat", "Notifications"],
    authors: [Devs.HyperCordTeam],
    settings,

    start() {
        FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
    },

    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
    }
});
