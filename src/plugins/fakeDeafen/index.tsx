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
        description: "Appear muted and deafened to others when you deafen, while you keep hearing everyone normally - your mic is genuinely cut, same as a real deafen, so nobody actually hears you either"
    }
});

export default definePlugin({
    name: "FakeDeafen",
    description: "Look muted/deafened to everyone else. Fake Mute keeps your mic actually broadcasting; Fake Deafen keeps you actually hearing everyone, but genuinely cuts your own mic.",
    tags: ["Voice"],
    authors: [Devs.HyperCordTeam],
    settings,
    settingsAboutComponent: () => (
        <Notice.Info>
            Use the normal Mute/Deafen buttons (or the Toggle Mute / Toggle Deafen commands) as usual - this
            plugin only changes what those do to your own audio engine while the matching setting above is
            on. Discord still broadcasts you as muted/deafened to everyone else either way. Fake Mute keeps
            your mic genuinely transmitting even though you look muted. Fake Deafen only fakes the listening
            side - you keep hearing everyone, but your mic is really cut (nobody actually hears you, same as
            a real deafen), so it isn't overridden here too. Turning a setting off mid-call, or actually
            unmuting/undeafening, always goes through for real.
        </Notice.Info>
    ),

    // The call site that actually engages the native audio engine looks like
    // `<conn>.setSelfMute(<mute>)` / `<conn>.setSelfDeaf(<deaf>)` - overriding
    // just the argument here means Discord's own broadcast of the real
    // self_mute/self_deaf state (built from the same original value elsewhere)
    // is untouched, while the local engine is told to stay unmuted/undeafened.
    //
    // setSelfMute is only overridden under fakeMute, not fakeDeafen - an
    // earlier version also forced it false under fakeDeafen (reasoning: real
    // Discord deafening auto-mutes you too, so without this your mic would
    // get genuinely cut), but that meant fakeDeafen secretly kept your own
    // audio broadcasting to everyone else while you merely looked deafened -
    // not what "fake deafen" is supposed to fake. Fake Deafen is only about
    // faking the *listening* side (you still hear everyone despite looking
    // deafened); the auto-mute that comes with a real deafen is left to
    // genuinely happen, same as unmodified Discord.
    patches: [
        {
            find: ".setSelfMute(",
            replacement: [
                {
                    match: /(\i)\.setSelfMute\((\i)\)/,
                    replace: (_, conn, mute) => `${conn}.setSelfMute($self.settings.store.fakeMute?false:${mute})`
                },
                {
                    match: /(\i)\.setSelfDeaf\((\i(?:\.\i)?)\)/,
                    replace: (_, conn, deaf) => `${conn}.setSelfDeaf($self.settings.store.fakeDeafen?false:${deaf})`
                }
            ]
        }
    ]
});
