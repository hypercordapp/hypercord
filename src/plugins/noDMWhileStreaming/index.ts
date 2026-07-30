/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getUserSettingLazy } from "@api/UserSettings";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ApplicationStreamingStore } from "@webpack/common";

// Same status-setting mechanism AutoDNDWhilePlaying already proves works
// (getUserSettingLazy("status","status") + getSetting/updateSetting) -
// triggered off ApplicationStreamingStore's own generic change listener
// (every Flux store exposes this, same as WindowStore/TidalStore/SettingsStore
// elsewhere in this repo) instead of guessing a specific stream-start/stop
// dispatch type name.
const StatusSettings = getUserSettingLazy<string>("status", "status")!;

let savedStatus: string | null = null;

function onStreamChange() {
    const stream = ApplicationStreamingStore.getCurrentUserActiveStream();
    const status = StatusSettings.getSetting();

    if (stream) {
        if (status !== "dnd") {
            savedStatus = status;
            StatusSettings.updateSetting("dnd");
        }
    } else if (savedStatus && savedStatus !== "dnd") {
        StatusSettings.updateSetting(savedStatus);
        savedStatus = null;
    }
}

export default definePlugin({
    name: "NoDMWhileStreaming",
    description: "Automatically switches you to Do Not Disturb while screen sharing, so incoming DM notifications don't pop up on stream, then restores your previous status when you stop",
    tags: ["Voice", "Utility"],
    authors: [Devs.HyperCordTeam],

    start() {
        ApplicationStreamingStore.addChangeListener(onStreamChange);
    },

    stop() {
        ApplicationStreamingStore.removeChangeListener(onStreamChange);
        savedStatus = null;
    }
});
