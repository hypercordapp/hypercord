/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

import { ScrobblerBackend, TrackData } from ".";

const logger = new Logger("MusicRichPresence/LastFM");

const url = (path: string) => `https://www.last.fm${path}`;

export const LastFMScrobbler: ScrobblerBackend = {
    name: "Last.FM",
    id: "lastfm",

    async fetchTrackData(username: string, apiKey: string): Promise<TrackData | null> {
        try {
            const params = new URLSearchParams({
                method: "user.getrecenttracks",
                api_key: apiKey,
                user: username,
                limit: "1",
                format: "json"
            });

            const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
            if (!res.ok) throw `${res.status} ${res.statusText}`;

            const json = await res.json();
            if (json.error) {
                logger.error("Error from Last.fm API", `${json.error}: ${json.message}`);
                return null;
            }

            const trackData = json.recenttracks?.track[0];

            if (!trackData?.["@attr"]?.nowplaying)
                return null;

            // why does the json api have xml structure
            // Last.fm omits the "album" field entirely for tracks that
            // aren't part of an album (singles, some scrobbles from other
            // clients) - trackData.album["#text"] threw on those and only
            // got caught by the outer try/catch, silently no-oping the
            // presence update for that whole cycle instead of just leaving
            // album info blank.
            const artistName = trackData.artist?.["#text"];
            const albumName = trackData.album?.["#text"];
            return {
                name: trackData.name || "Unknown",
                album: albumName,
                artist: artistName || "Unknown",
                trackURL: trackData.url,
                artistURL: artistName ? url(`/music/${encodeURIComponent(artistName)}`) : undefined,
                albumURL: (artistName && albumName) ? url(`/music/${encodeURIComponent(artistName)}/${encodeURIComponent(albumName)}`) : undefined,
                imageURL: trackData.image?.find((x: any) => x.size === "large")?.["#text"]
            } as TrackData;
        } catch (e) {
            logger.error("Failed to query Last.FM API", e);
            // will clear the rich presence if API fails
            return null;
        }
    },

    getUserURL(username: string): string {
        return url(`/user/${username}`);
    }
};
