/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ConfirmModal, GuildStore, openModal } from "@webpack/common";

// Same module relationshipNotifier already patches ("async leaveGuild(" -
// confirmed present in Discord's real bundle) - found here by two OTHER
// properties it's known to also export, so the already-loaded module object
// this resolves to has leaveGuild on it too, no patch needed to call it.
const GuildActions = findByPropsLazy("setServerMute", "setServerDeaf");

async function leaveAllGuilds(channelId: string) {
    const guilds = Object.keys(GuildStore.getGuilds());
    let left = 0;

    for (const guildId of guilds) {
        try {
            await GuildActions.leaveGuild(guildId);
            left++;
        } catch {
            // keep going even if one guild fails (e.g. you're the owner and can't leave)
        }
        await new Promise(r => setTimeout(r, 500));
    }

    sendBotMessage(channelId, { content: `Left ${left}/${guilds.length} server(s).` });
}

export default definePlugin({
    name: "LeaveAllServers",
    description: "Adds a /leaveallservers command to leave every server you're in at once - asks for confirmation first, since it can't be undone from here",
    tags: ["Utility", "Commands"],
    authors: [Devs.HyperCordTeam],

    commands: [
        {
            name: "leaveallservers",
            description: "Leave every server you're currently in (asks for confirmation first)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_args, ctx) => {
                const count = Object.keys(GuildStore.getGuilds()).length;

                openModal(props => (
                    <ConfirmModal
                        {...props}
                        title="Leave every server?"
                        subtitle={`This will leave all ${count} server(s) you're currently in. You'd need a new invite to rejoin any of them.`}
                        confirmText="Leave all"
                        cancelText="Cancel"
                        onConfirm={() => leaveAllGuilds(ctx.channel.id)}
                    />
                ));
            }
        }
    ]
});
