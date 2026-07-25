/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Notice } from "@components/Notice";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findLazy } from "@webpack";

const logger = new Logger("FakeDeafen");

// EXPERIMENTAL: there's no persistent "voice connection" singleton to hook -
// one is created per active call - so this patches the shared prototype
// instead, which covers every instance regardless of when it's created.
// Matched on this specific combination of real (unminified) method names,
// since Discord doesn't rename class members the way it renames locals; if a
// future Discord update stops matching, findLazy just never resolves and
// start() logs a warning instead of throwing - toggle Mute/Deafen normally
// and you fall back to genuinely muting/deafening, never to silently doing
// nothing while looking fine.
const VoiceConnection = findLazy(m => m?.prototype?.setSelfMute && m.prototype?.setSelfDeaf && m.prototype?.setLocalMute);

const settings = definePluginSettings({
    fakeMute: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Appear muted to others when you mute, while your own mic keeps working for you"
    },
    fakeDeafen: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Appear deafened to others when you deafen, while you keep hearing everyone normally"
    }
});

let originalSetSelfMute: ((mute: boolean) => void) | undefined;
let originalSetSelfDeaf: ((deaf: boolean) => void) | undefined;

// Resolving VoiceConnection (a lazy webpack find) can throw - either because
// Vencord's find() reports a hard failure in dev builds when nothing matches,
// or because some unrelated module's exports throw on property access while
// the filter scans through everything currently loaded. Either way, this must
// never take plugin start() down with it - a filter that stops matching
// should just mean "no fake mute/deafen this time", not a crash.
function patchConnection(): boolean {
    try {
        if (!VoiceConnection?.prototype || originalSetSelfMute) return false;

        originalSetSelfMute = VoiceConnection.prototype.setSelfMute;
        originalSetSelfDeaf = VoiceConnection.prototype.setSelfDeaf;

        VoiceConnection.prototype.setSelfMute = function (this: unknown, mute: boolean) {
            // Only the "go silent" direction is faked - unmuting always goes through for real,
            // so turning the setting off mid-call can't leave you stuck silently muted.
            if (mute && settings.store.fakeMute) return;
            return originalSetSelfMute!.call(this, mute);
        };

        VoiceConnection.prototype.setSelfDeaf = function (this: unknown, deaf: boolean) {
            if (deaf && settings.store.fakeDeafen) return;
            return originalSetSelfDeaf!.call(this, deaf);
        };

        return true;
    } catch (e) {
        logger.error("Failed to patch the voice connection class", e);
        return false;
    }
}

function unpatchConnection() {
    try {
        if (VoiceConnection?.prototype && originalSetSelfMute) {
            VoiceConnection.prototype.setSelfMute = originalSetSelfMute;
            VoiceConnection.prototype.setSelfDeaf = originalSetSelfDeaf;
        }
    } catch (e) {
        logger.error("Failed to unpatch the voice connection class", e);
    }
    originalSetSelfMute = originalSetSelfDeaf = undefined;
}

export default definePlugin({
    name: "FakeDeafen",
    description: "Look muted/deafened to everyone else while your own mic and audio keep working normally. EXPERIMENTAL - relies on undocumented internals.",
    tags: ["Voice"],
    authors: [Devs.HyperCordTeam],
    settings,
    settingsAboutComponent: () => (
        <Notice.Warning>
            Experimental: this patches an internal voice engine method that a future Discord update could
            rename or restructure without warning. Use the normal Mute/Deafen buttons (or the Toggle Mute
            / Toggle Deafen commands) as usual - this plugin only changes what those do to your own audio
            while the matching setting above is on. If the internals it depends on ever go missing, muting
            or deafening just goes back to doing the real thing, never to looking fake while doing nothing.
        </Notice.Warning>
    ),

    start() {
        if (!patchConnection()) {
            logger.warn("Could not locate or patch the voice connection class - Fake Mute/Deafen will behave like the real thing until this is fixed.");
        }
    },

    stop() {
        unpatchConnection();
    }
});
