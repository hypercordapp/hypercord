/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { GuildStore } from "@webpack/common";

// Same action creator NewGuildSettings already calls to mute a single guild -
// reused here in a loop over every guild instead of just one.
const { updateGuildNotificationSettings } = findByPropsLazy("updateGuildNotificationSettings");

export default definePlugin({
    name: "MuteAllServers",
    description: "Adds a /muteallservers command to mute every server you're in with one command - fully reversible, unmute any of them normally afterward",
    tags: ["Utility", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "muteallservers",
            description: "Mute every server you're currently in",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_args, ctx) => {
                const guildIds = Object.keys(GuildStore.getGuilds());

                for (const id of guildIds) {
                    updateGuildNotificationSettings(id, { muted: true });
                }

                sendBotMessage(ctx.channel.id, { content: `Muted ${guildIds.length} server(s).` });
            }
        }
    ]
});
