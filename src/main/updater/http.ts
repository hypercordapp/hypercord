/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { IpcEvents } from "@shared/IpcEvents";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { createHash } from "crypto";
import { ipcMain } from "electron";
import { writeFile } from "fs/promises";
import { join } from "path";

import gitHash from "~git-hash";
import gitRemote from "~git-remote";

import { serializeErrors, VENCORD_FILES } from "./common";

const API_BASE = `https://api.github.com/repos/${gitRemote}`;
let PendingUpdates = [] as [string, string][];
let ChecksumsUrl: string | undefined;

async function githubGet<T = any>(endpoint: string) {
    return fetchJson<T>(API_BASE + endpoint, {
        headers: {
            Accept: "application/vnd.github+json",
            // "All API requests MUST include a valid User-Agent header.
            // Requests with no User-Agent header will be rejected."
            "User-Agent": VENCORD_USER_AGENT
        }
    });
}

async function calculateGitChanges() {
    const isOutdated = await fetchUpdates();
    if (!isOutdated) return [];

    try {
        const data = await githubGet(`/compare/${gitHash}...HEAD`);

        return data.commits.map((c: any) => ({
            // github api only sends the long sha
            hash: c.sha.slice(0, 7),
            author: c.author?.login ?? c.commit?.author?.name ?? "Unknown Author",
            message: c.commit.message.split("\n")[0]
        }));
    } catch {
        // This changelog is purely cosmetic - the actual update (fetchUpdates
        // above) already succeeded and populated PendingUpdates. A local
        // build's commit hash can vanish from the remote's history entirely
        // after a force-push/history rewrite, which 404s this compare call
        // forever for that install - don't let that block the update itself.
        return [{ hash: gitHash, author: "HyperCord", message: "A new update is available" }];
    }
}

async function fetchUpdates() {
    const data = await githubGet("/releases/latest");

    const hash = data.name.slice(data.name.lastIndexOf(" ") + 1);

    // Reset before repopulating, not just on the early "no update" return -
    // this function (and the check that calls it) can run more than once per
    // session (e.g. revisiting the update settings page), and without this
    // every re-check appended another full copy of the same file list onto
    // PendingUpdates instead of replacing it. applyUpdates() still only
    // wrote each file's *last* queued content, so nothing corrupted, but every
    // extra check meant every file got needlessly re-downloaded and re-hashed
    // once per prior check, growing without bound the longer a session (and
    // its outdated-update banner) stuck around.
    PendingUpdates = [];

    if (hash === gitHash) {
        ChecksumsUrl = undefined;
        return false;
    }

    ChecksumsUrl = data.assets.find(({ name }: any) => name === "checksums.txt")?.browser_download_url;

    data.assets.forEach(({ name, browser_download_url }) => {
        if (VENCORD_FILES.some(s => name.startsWith(s))) {
            PendingUpdates.push([name, browser_download_url]);
        }
    });

    return true;
}

// Parses sha256sum's "<hex digest>  <filename>" output format into a lookup map.
function parseChecksums(text: string) {
    const map = new Map<string, string>();
    for (const line of text.split("\n")) {
        const match = /^([a-f0-9]{64})\s+\*?(.+?)\s*$/.exec(line);
        if (match) map.set(match[2], match[1]);
    }
    return map;
}

async function applyUpdates() {
    if (!ChecksumsUrl) {
        throw new Error("Refusing to apply update: no checksums.txt found in the release, cannot verify integrity");
    }

    const checksumsText = (await fetchBuffer(ChecksumsUrl)).toString("utf-8");
    const checksums = parseChecksums(checksumsText);

    const fileContents = await Promise.all(PendingUpdates.map(async ([name, url]) => {
        const contents = await fetchBuffer(url);

        const expected = checksums.get(name);
        if (!expected) throw new Error(`Refusing to apply update: no checksum entry for ${name}`);

        const actual = createHash("sha256").update(contents).digest("hex");
        if (actual !== expected) {
            throw new Error(`Refusing to apply update: ${name} failed checksum verification (expected ${expected}, got ${actual})`);
        }

        return [join(__dirname, name), contents] as const;
    }));

    await Promise.all(fileContents.map(async ([filename, contents]) =>
        writeFile(filename, contents))
    );

    PendingUpdates = [];
    return true;
}

ipcMain.handle(IpcEvents.GET_REPO, serializeErrors(() => `https://github.com/${gitRemote}`));
ipcMain.handle(IpcEvents.GET_UPDATES, serializeErrors(calculateGitChanges));
ipcMain.handle(IpcEvents.UPDATE, serializeErrors(fetchUpdates));
ipcMain.handle(IpcEvents.BUILD, serializeErrors(applyUpdates));
