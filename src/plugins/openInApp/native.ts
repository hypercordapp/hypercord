/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";
import { request } from "https";

// These links don't support CORS, so this has to be native
const validRedirectUrls = /^https:\/\/(spotify\.link|s\.team)\/.+$/;

const MAX_REDIRECTS = 10;

function getRedirect(url: string, redirectsLeft: number) {
    return new Promise<string>((resolve, reject) => {
        let target: URL;
        try {
            target = new URL(url);
        } catch {
            resolve(url);
            return;
        }

        // Every hop is a request from the privileged main process - only ever
        // follow it somewhere else if the destination is still plain https,
        // same as the initial shortlink check above.
        if (target.protocol !== "https:") {
            resolve(url);
            return;
        }

        if (redirectsLeft <= 0) {
            resolve(url);
            return;
        }

        const req = request(target, { method: "HEAD" }, res => {
            resolve(
                res.headers.location
                    ? getRedirect(res.headers.location, redirectsLeft - 1)
                    : url
            );
        });
        req.on("error", reject);
        req.end();
    });
}

export async function resolveRedirect(_: IpcMainInvokeEvent, url: string) {
    if (!validRedirectUrls.test(url)) return url;

    return getRedirect(url, MAX_REDIRECTS);
}
