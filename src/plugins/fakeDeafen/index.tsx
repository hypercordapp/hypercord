/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Notice } from "@components/Notice";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    fakeMute: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Appear muted to others when you mute, while your own mic keeps working for you"
    },
    fakeDeafen: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Appear muted and deafened to others when you deafen, while you keep hearing and talking normally"
    }
});

export default definePlugin({
    name: "FakeDeafen",
    description: "Look muted/deafened to everyone else while your own mic and audio keep working normally.",
    tags: ["Voice"],
    authors: [Devs.HyperCordTeam],
    settings,
    settingsAboutComponent: () => (
        <Notice.Info>
            Use the normal Mute/Deafen buttons (or the Toggle Mute / Toggle Deafen commands) as usual - this
            plugin only changes what those do to your own audio engine while the matching setting above is
            on. Discord still broadcasts you as muted/deafened to everyone else; your own mic/audio just
            keeps working locally. Turning a setting off mid-call, or actually unmuting, always goes
            through for real.
        </Notice.Info>
    ),

    // The call site that actually engages the native audio engine looks like
    // `<conn>.setSelfMute(<mute>)` / `<conn>.setSelfDeaf(<deaf>)` - overriding
    // just the argument here means Discord's own broadcast of the real
    // self_mute/self_deaf state (built from the same original value elsewhere)
    // is untouched, while the local engine is told to stay unmuted/undeafened.
    //
    // Real Discord deafening also mutes you (you can't meaningfully listen-only
    // without also cutting your mic in the normal client) - so setSelfMute
    // needs to stay live under fakeDeafen too, not just fakeMute, or clicking
    // Deafen with only "fake deafen" enabled genuinely cut your mic even
    // though you still appeared to be able to talk.
    patches: [
        {
            find: ".setSelfMute(",
            replacement: [
                {
                    match: /(\i)\.setSelfMute\((\i)\)/,
                    replace: (_, conn, mute) => `${conn}.setSelfMute($self.settings.store.fakeMute||$self.settings.store.fakeDeafen?false:${mute})`
                },
                {
                    match: /(\i)\.setSelfDeaf\((\i(?:\.\i)?)\)/,
                    replace: (_, conn, deaf) => `${conn}.setSelfDeaf($self.settings.store.fakeDeafen?false:${deaf})`
                }
            ]
        }
    ]
});
