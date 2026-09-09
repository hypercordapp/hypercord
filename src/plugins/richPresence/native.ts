/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { GrTrackData } from "./types/gensokyoRadio";

export async function fetchTrackData(): Promise<GrTrackData | null> {
    try {
        const res = await fetch("https://gensokyoradio.net/api/station/playing/");
        if (!res.ok) return null;
        const song = await res.json();
        if (!song?.SONGINFO || !song?.SONGTIMES) return null;

        return {
            title: song.SONGINFO.TITLE ?? "",
            album: song.SONGINFO.ALBUM ?? "",
            artist: song.SONGINFO.ARTIST ?? "",
            position: song.SONGTIMES.SONGSTART ?? 0,
            duration: song.SONGTIMES.SONGEND ?? 0,
            artwork: song.MISC?.ALBUMART ? `https://gensokyoradio.net/images/albums/500/${song.MISC.ALBUMART}` : "",
        };
    } catch {
        return null;
    }
}
