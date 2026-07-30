/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findCssClassesLazy } from "@webpack";
import { moment } from "@webpack/common";

// Same class lookup BetterSessions already proves resolves to Discord's real
// rendered <time> elements - reused here to update their text directly
// (moment().fromNow(), already a dependency via CustomTimestamps) every
// second, instead of only whenever React happens to re-render that message.
const TimestampClasses = findCssClassesLazy("timestamp", "blockquoteContainer");

let intervalId: any;

function tick() {
    const className = TimestampClasses.timestamp;
    if (!className) return;

    for (const el of Array.from(document.getElementsByClassName(className))) {
        const time = el as HTMLTimeElement;
        if (!time.dateTime) continue;

        const relative = moment(time.dateTime).fromNow();
        if (time.textContent !== relative) time.textContent = relative;
    }
}

export default definePlugin({
    name: "RealtimeTimestamps",
    description: "Keeps every visible message timestamp ticking live (e.g. '3 seconds ago' updates every second) instead of only updating whenever that message happens to re-render",
    tags: ["Chat", "Appearance"],
    authors: [Devs.HyperCordTeam],

    start() {
        intervalId = setInterval(tick, 1000);
    },

    stop() {
        clearInterval(intervalId);
    }
});
