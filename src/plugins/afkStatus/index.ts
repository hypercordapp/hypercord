/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, FluxDispatcher, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    message: {
        type: OptionType.STRING,
        description: "Your AFK message",
        default: "I'm currently AFK, I'll get back to you soon."
    },
    isAfk: {
        type: OptionType.BOOLEAN,
        description: "Whether AFK mode is currently active",
        default: false,
        hidden: true
    }
});

const repliedChannels = new Set<string>();

function onMessageCreate({ message }: any) {
    try {
        if (!settings.store.isAfk) return;

        const self = UserStore.getCurrentUser();
        if (!self || message.author?.id === self.id) return;
        if (repliedChannels.has(message.channelId)) return;

        const channel = ChannelStore.getChannel(message.channelId);
        const isDM = channel?.isDM?.() ?? channel?.type === 1;
        const isMentioned = message.mentions?.some?.((u: any) => u.id === self.id);

        if (!isDM && !isMentioned) return;

        repliedChannels.add(message.channelId);
        sendMessage(message.channelId, { content: `**[AFK]** ${settings.store.message}` });
    } catch { }
}

export default definePlugin({
    name: "AfkStatus",
    description: "Toggle an AFK status that auto-replies once per channel to DMs and mentions while you're away",
    tags: ["Utility", "Chat", "Commands"],
    authors: [Devs.HyperCordTeam],
    settings,

    start() {
        FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
    },

    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
        repliedChannels.clear();
    },

    commands: [
        {
            name: "afk",
            description: "Toggle AFK mode, optionally with a custom message",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "message", description: "Custom AFK message", type: ApplicationCommandOptionType.STRING, required: false }
            ],
            execute: (args, ctx) => {
                const message = findOption(args, "message", "");
                if (message) settings.store.message = message;

                settings.store.isAfk = !settings.store.isAfk;
                if (!settings.store.isAfk) repliedChannels.clear();

                sendBotMessage(ctx.channel.id, {
                    content: settings.store.isAfk
                        ? `AFK mode enabled: "${settings.store.message}"`
                        : "AFK mode disabled."
                });
            }
        }
    ]
});
