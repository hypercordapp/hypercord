/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgeUserArgs, removeProfileBadge } from "@api/Badges";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FluxDispatcher, PresenceStore, UserStore } from "@webpack/common";

// Discord never actually tells a client whether someone is truly offline or
// just invisible - an invisible user's real presence is withheld from every
// other client, including friends, and always reports as plain "offline"
// (PresenceStore.getStatus can't distinguish the two, by design on Discord's
// end - this isn't something HyperCord can "unlock"). What Discord DOES still
// send regardless of invisible status is TYPING_START for a channel you can
// see - a long-known quirk, not a HyperCord invention. So this is a heuristic,
// not a real detector: if someone shown as "offline" is seen typing, they were
// online a moment ago. A real, fully offline user can never generate that
// event. False negatives are expected (an invisible user who never types
// looks identical to genuinely offline) - this can only ever prove presence,
// never prove its absence.
const RECENTLY_TYPING_WINDOW_MS = 5 * 60 * 1000;

const seenTypingWhileOffline = new Map<string, number>();

function pruneExpired() {
    const cutoff = Date.now() - RECENTLY_TYPING_WINDOW_MS;
    for (const [userId, seenAt] of seenTypingWhileOffline) {
        if (seenAt < cutoff) seenTypingWhileOffline.delete(userId);
    }
}

function onTypingStart(event: { userId: string; }) {
    const { userId } = event;
    if (!userId || userId === UserStore.getCurrentUser()?.id) return;

    // "offline" is what Discord reports for BOTH genuinely offline and
    // invisible users - that ambiguity is exactly the point of this plugin.
    const status = PresenceStore.getStatus(userId) ?? "offline";
    if (status !== "offline") return;

    seenTypingWhileOffline.set(userId, Date.now());
}

const badge = {
    id: "hypercord_invisible_typing_badge",
    component: ({ userId }: BadgeUserArgs) => (
        <span
            style={{ fontSize: 14, lineHeight: 1 }}
            title="Shown as offline, but was seen typing recently - they may actually be online with an invisible status. This is a heuristic guess, not confirmed."
        >
            👻
        </span>
    ),
    shouldShow: ({ userId }: BadgeUserArgs) => {
        pruneExpired();
        return seenTypingWhileOffline.has(userId);
    }
};

export default definePlugin({
    name: "InvisibleTyping",
    description: "Flags users shown as offline who were recently seen typing - a hint they might actually be online with an invisible status, rather than genuinely offline. Heuristic only: Discord never reveals real invisible presence, this just catches the one signal (typing) it doesn't hide",
    tags: ["Utility"],
    authors: [Devs.HyperCordTeam],

    start() {
        FluxDispatcher.subscribe("TYPING_START", onTypingStart);
        addProfileBadge(badge);
    },

    stop() {
        FluxDispatcher.unsubscribe("TYPING_START", onTypingStart);
        removeProfileBadge(badge);
        seenTypingWhileOffline.clear();
    }
});
