/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { Constants, FluxDispatcher, RestAPI, SnowflakeUtils, UserStore } from "@webpack/common";

const logger = new Logger("AntiDeleteMessage");

// Keyed by message id - only ever holds YOUR OWN sent messages (MESSAGE_CREATE
// already tells us the real author, no guessing), capped so it can't grow
// unbounded over a long session.
const ownRecentMessages = new Map<string, { channelId: string; content: string; }>();
const MAX_CACHED = 200;

function onMessageCreate({ message }: any) {
    if (!message?.content) return;
    if (message.author?.id !== UserStore.getCurrentUser()?.id) return;

    ownRecentMessages.set(message.id, { channelId: message.channel_id, content: message.content });

    if (ownRecentMessages.size > MAX_CACHED) {
        const oldest = ownRecentMessages.keys().next().value;
        if (oldest) ownRecentMessages.delete(oldest);
    }
}

async function onMessageDelete({ id, channelId }: { id: string; channelId: string; }) {
    const cached = ownRecentMessages.get(id);
    if (!cached) return;

    ownRecentMessages.delete(id);

    try {
        await RestAPI.post({
            url: Constants.Endpoints.MESSAGES(channelId),
            body: { content: cached.content, nonce: SnowflakeUtils.fromTimestamp(Date.now()) }
        });
    } catch (e) {
        logger.error("Failed to resend deleted message", e);
    }
}

export default definePlugin({
    name: "AntiDeleteMessage",
    description: "Automatically resends your own messages if someone else deletes them",
    tags: ["Chat"],
    authors: [Devs.HyperCordTeam],

    start() {
        FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
        FluxDispatcher.subscribe("MESSAGE_DELETE", onMessageDelete);
    },

    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
        FluxDispatcher.unsubscribe("MESSAGE_DELETE", onMessageDelete);
        ownRecentMessages.clear();
    }
});
