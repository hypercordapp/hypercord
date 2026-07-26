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
        description: "Appear muted to others when you mute (not deafen), while your own mic keeps working for you"
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
            your mic genuinely transmitting when you mute - but never during a deafen, so deafening always
            genuinely cuts your mic for real regardless of Fake Mute. Fake Deafen only fakes the listening
            side - you keep hearing everyone, but nobody actually hears you either, same as a real deafen.
            Turning a setting off mid-call, or actually unmuting/undeafening, always goes through for real.
        </Notice.Info>
    ),

    // Verified against the live client (not guessed): both calls happen
    // together, in one statement, in the single function that (re)syncs the
    // native engine to the current mute/deaf targets - `function ns(e){let
    // t=ni(e.context),n=!to||t.mute||t.deaf; ... e.setSelfMute(n),
    // e.setSelfDeaf(t.deaf), ...}`. This runs far more often than just on a
    // button click (any VAD/PTT/permission recompute re-triggers it too), so
    // whatever this patch decides keeps re-asserting continuously for as
    // long as the underlying mute/deaf state stays the same - not just at
    // the moment you click.
    //
    // <mute> (`n` above) is already `t.mute||t.deaf||<other real reasons>` -
    // an OR'd "should be muted for any reason", not just the manual mute
    // toggle - so it alone can't tell a plain mute click apart from the
    // auto-mute that comes bundled with deafening. <deaf> (`t.deaf`) is the
    // raw, undiluted deafen target from the same statement, which is what
    // lets this tell the two apart: whenever <deaf> is true, this is a
    // deafen (or deafen-driven re-sync), so <mute> is always passed through
    // unmodified - Fake Mute's override only applies to a plain mute
    // (<deaf> false). This is deliberately independent of whether Fake
    // Deafen is even on: a real deafen should always genuinely cut the mic
    // for everyone, same as unmodified Discord, regardless of Fake Mute
    // being separately enabled for plain mutes - otherwise deafening while
    // Fake Mute was on for an unrelated reason kept the mic broadcasting
    // despite looking both muted and deafened. Fake Deafen only ever
    // controls the *listening* side (setSelfDeaf).
    patches: [
        {
            find: ".setSelfMute(",
            replacement: {
                match: /(\i)\.setSelfMute\((\i)\),\1\.setSelfDeaf\((\i(?:\.\i)?)\)/,
                replace: (_, conn, mute, deaf) =>
                    `${conn}.setSelfMute(${deaf}?${mute}:$self.settings.store.fakeMute?false:${mute}),` +
                    `${conn}.setSelfDeaf($self.settings.store.fakeDeafen?false:${deaf})`
            }
        }
    ]
});
