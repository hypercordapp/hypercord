/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

// AUDIO_SET_NOISE_SUPPRESSION is a real, confirmed Flux action type (see
// AltKrispSwitch's own patch, which matches this exact dispatch) - this just
// fires it directly to force Krisp back on, for when it silently stops being
// offered as an option after a device/permission change without a full
// Discord restart. Best-effort: the flag flips for certain, whether that
// alone also resets Krisp's underlying audio pipeline hasn't been verified
// against every failure mode described for the original request.
export default definePlugin({
    name: "FixKrisp",
    description: "Adds a toolbox action that forces Discord's noise suppression (Krisp) back on, for when it silently becomes unavailable without a full restart",
    tags: ["Voice", "Utility"],
    authors: [Devs.HyperCordTeam],

    toolboxActions: {
        "Force Krisp Noise Suppression On"() {
            FluxDispatcher.dispatch({
                type: "AUDIO_SET_NOISE_SUPPRESSION",
                enable: true
            } as any);
        }
    }
});
