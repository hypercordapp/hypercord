/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";
import { isIP } from "net";

import { NativeUploadResult, NestUploadResponse } from "./types";

// fetchFile below runs an unrestricted network fetch from the Electron MAIN
// process on behalf of a URL that (via the message/image context menu path
// in index.tsx -> getMediaUrl) can come straight from another Discord user's
// message content (an embedded image or a masked link ending in a supported
// extension) - not just from something the local user typed themselves. It's
// also reachable directly by any renderer-side script at all via
// VencordNative.pluginHelpers.FileUpload.fetchFile(url), since plugin native
// IPC methods are exposed generically regardless of whether FileUpload is
// even enabled. Unlike a renderer fetch(), a main-process fetch is not
// subject to the app's CSP allowlist (src/main/csp) at all, so without this
// check this handler is a full SSRF primitive - a crafted message link could
// make a victim's client (via one context-menu click, or instantly via any
// malicious theme/userplugin) reach internal-only network resources
// (localhost services, cloud metadata endpoints, LAN admin panels, etc.) that
// the CSP is specifically there to keep the renderer away from. Blocking
// loopback/private/link-local/CGNAT literal IPs (and the usual localhost
// hostname aliases) closes the actually-reachable exploit path; this can't
// catch a DNS-rebinding attack against a public hostname that later resolves
// to a private IP, but that's a much higher-effort attack than the trivial
// "paste an internal IP as an image link" one this stops.
const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback"]);

function isPrivateOrLoopbackIPv4(ip: string): boolean {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(p => Number.isNaN(p))) return true;

    const [a, b] = parts;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata 169.254.169.254
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 0) return true; // "this network"
    return false;
}

function isPrivateOrLoopbackIPv6(ip: string): boolean {
    const normalized = ip.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local fc00::/7
    if (/^fe[89ab]/.test(normalized)) return true; // link-local fe80::/10

    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
    if (mapped) return isPrivateOrLoopbackIPv4(mapped[1]);

    return false;
}

function isSafeExternalUrl(url: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(hostname)) return false;

    const ipVersion = isIP(hostname);
    if (ipVersion === 4) return !isPrivateOrLoopbackIPv4(hostname);
    if (ipVersion === 6) return !isPrivateOrLoopbackIPv6(hostname);

    return true;
}

export async function uploadToNest(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string,
    authToken: string
): Promise<NativeUploadResult> {
    try {
        const formData = new FormData();
        formData.append("file", new Blob([fileBuffer]), filename);

        const response = await fetch("https://nest.rip/api/files/upload", {
            method: "POST",
            headers: {
                "Authorization": authToken
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        const data = await response.json() as NestUploadResponse;

        if (data.fileURL) {
            return { success: true, url: data.fileURL };
        }

        return { success: false, error: "No URL returned from upload" };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToEzHost(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string,
    key: string
): Promise<NativeUploadResult> {
    try {
        const formData = new FormData();
        formData.append("file", new Blob([fileBuffer]), filename);

        const response = await fetch("https://api.e-z.host/files", {
            method: "POST",
            headers: {
                key
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        const data = await response.json() as { success: boolean; error?: string; imageUrl?: string; rawUrl?: string; };

        if (!data || !data.success) {
            return { success: false, error: data?.error || "Upload failed" };
        }

        if (data.imageUrl || data.rawUrl) {
            return { success: true, url: data.imageUrl || data.rawUrl };
        }

        return { success: false, error: "No URL returned from upload" };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadTo0x0(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string
): Promise<NativeUploadResult> {
    try {
        const formData = new FormData();
        formData.append("file", new Blob([fileBuffer]), filename);

        const response = await fetch("https://0x0.st", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        const text = (await response.text()).trim();
        if (!text) {
            return { success: false, error: "No URL returned from upload" };
        }

        return { success: true, url: text };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToS3(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    uploadUrl: string,
    headers: Record<string, string>
): Promise<NativeUploadResult> {
    try {
        const response = await fetch(uploadUrl, {
            method: "PUT",
            headers,
            body: new Blob([fileBuffer])
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        return { success: true, url: uploadUrl };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToCatbox(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string,
    userhash?: string
): Promise<NativeUploadResult> {
    try {
        const formData = new FormData();
        formData.append("reqtype", "fileupload");
        if (userhash) {
            formData.append("userhash", userhash);
        }
        formData.append("fileToUpload", new Blob([fileBuffer]), filename);

        const response = await fetch("https://catbox.moe/user/api.php", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        const text = (await response.text()).trim();
        if (!text) {
            return { success: false, error: "No URL returned from upload" };
        }

        return { success: true, url: text };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToLitterbox(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string,
    expiry: string
): Promise<NativeUploadResult> {
    try {
        const formData = new FormData();
        formData.append("reqtype", "fileupload");
        formData.append("time", expiry);
        formData.append("fileToUpload", new Blob([fileBuffer]), filename);

        const response = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        const text = (await response.text()).trim();
        if (!text) {
            return { success: false, error: "No URL returned from upload" };
        }

        return { success: true, url: text };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToGofile(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string,
    token?: string
): Promise<NativeUploadResult> {
    try {
        const formData = new FormData();
        if (token?.trim()) {
            formData.append("token", token.trim());
        }
        formData.append("file", new Blob([fileBuffer]), filename);

        const response = await fetch("https://upload.gofile.io/uploadfile", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        const data = await response.json() as {
            status?: string;
            error?: string;
            data?: { downloadPage?: string; code?: string; };
        };

        if (data.status !== "ok") {
            return { success: false, error: data.error || "Upload failed" };
        }

        const url = data.data?.downloadPage || (data.data?.code ? `https://gofile.io/d/${data.data.code}` : "");
        if (!url) {
            return { success: false, error: "No URL returned from upload" };
        }

        return { success: true, url };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToTmpfiles(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string
): Promise<NativeUploadResult> {
    try {
        const formData = new FormData();
        formData.append("file", new Blob([fileBuffer]), filename);

        const response = await fetch("https://tmpfiles.org/api/v1/upload", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        const data = await response.json() as { status?: string; data?: { url?: string; }; };
        const rawUrl = data.data?.url || "";
        if (!rawUrl || data.status !== "success") {
            return { success: false, error: "No URL returned from upload" };
        }

        const url = rawUrl.includes("tmpfiles.org/") && !rawUrl.includes("/dl/")
            ? rawUrl.replace(/tmpfiles\.org\/(\d+)/, "tmpfiles.org/dl/$1")
            : rawUrl;

        return { success: true, url };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToBuzzheavier(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string
): Promise<NativeUploadResult> {
    try {
        const response = await fetch(`https://w.buzzheavier.com/${encodeURIComponent(filename)}`, {
            method: "PUT",
            body: new Blob([fileBuffer])
        });

        const text = await response.text();
        if (!response.ok) {
            return { success: false, error: `Upload failed: ${response.status} ${text}` };
        }

        try {
            const data = JSON.parse(text) as { code?: number; data?: { id?: string; }; };
            if (data.code === 201 && data.data?.id) {
                return { success: true, url: `https://buzzheavier.com/${data.data.id}` };
            }
        } catch {
        }

        const url = text.trim();
        if (!url) {
            return { success: false, error: "No URL returned from upload" };
        }

        return { success: true, url };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToTempSh(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string
): Promise<NativeUploadResult> {
    try {
        const formData = new FormData();
        formData.append("file", new Blob([fileBuffer]), filename);

        const response = await fetch("https://temp.sh/upload", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        const url = (await response.text()).trim();
        if (!url) {
            return { success: false, error: "No URL returned from upload" };
        }

        return { success: true, url };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToFilebin(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string
): Promise<NativeUploadResult> {
    try {
        const binId = `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
        const uploadUrl = `https://filebin.net/${binId}/${encodeURIComponent(filename)}`;

        const formData = new FormData();
        formData.append("file", new Blob([fileBuffer]), filename);

        const response = await fetch(uploadUrl, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        return { success: true, url: `https://filebin.net/${binId}/${encodeURIComponent(filename)}` };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToPixelVault(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string,
    uploadKey: string
): Promise<NativeUploadResult> {
    try {
        const formData = new FormData();
        formData.append("file", new Blob([fileBuffer]), filename);

        const response = await fetch("https://pixelvault.co/", {
            method: "POST",
            headers: {
                Authorization: uploadKey
            },
            body: formData
        });

        const text = await response.text();
        let data: { resource?: string; url?: string; } | null = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }

        if (!response.ok) {
            return { success: false, error: `Upload failed: ${response.status} ${text}` };
        }

        const url = data?.resource || data?.url || text.trim();
        if (!url) {
            return { success: false, error: "No URL returned from upload" };
        }

        return { success: true, url };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToPixelDrain(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string,
    apiKey?: string
): Promise<NativeUploadResult> {
    try {
        const headers: Record<string, string> = {};
        if (apiKey?.trim()) {
            headers.Authorization = `Basic ${Buffer.from(`:${apiKey.trim()}`).toString("base64")}`;
        }

        const response = await fetch(`https://pixeldrain.com/api/file/${encodeURIComponent(filename)}`, {
            method: "PUT",
            headers,
            body: new Blob([fileBuffer])
        });

        const text = await response.text();
        let data: { id?: string; message?: string; } | null = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }

        if (!response.ok) {
            return { success: false, error: data?.message || `Upload failed: ${response.status} ${text}` };
        }

        if (!data?.id) {
            return { success: false, error: data?.message || "No URL returned from upload" };
        }

        return { success: true, url: `https://pixeldrain.com/u/${data.id}` };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

function isValidHttpsUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:";
    } catch {
        return false;
    }
}

export async function uploadToWebdav(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    uploadUrl: string,
    headers: Record<string, string>
): Promise<NativeUploadResult> {
    if (!isValidHttpsUrl(uploadUrl)) {
        return { success: false, error: "Invalid or non-HTTPS upload URL" };
    }

    try {
        const response = await fetch(uploadUrl, {
            method: "PUT",
            headers,
            body: new Blob([fileBuffer])
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        return { success: true, url: uploadUrl };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function createWebdavShare(
    _: IpcMainInvokeEvent,
    ocsUrl: string,
    headers: Record<string, string>,
    body: string
): Promise<NativeUploadResult> {
    if (!isValidHttpsUrl(ocsUrl)) {
        return { success: false, error: "Invalid or non-HTTPS share endpoint URL" };
    }

    try {
        const response = await fetch(ocsUrl, {
            method: "POST",
            headers,
            body
        });

        const text = await response.text();

        if (!response.ok) {
            return { success: false, error: `Share creation failed: ${response.status} ${text.slice(0, 200)}` };
        }

        let data: { ocs?: { data?: { token?: string; }; }; };
        try {
            data = JSON.parse(text);
        } catch {
            return { success: false, error: `Invalid share response: ${text.slice(0, 200)}` };
        }

        const token = data?.ocs?.data?.token;
        if (!token) {
            return { success: false, error: "No share token in server response" };
        }

        return { success: true, url: token };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function fetchFile(

    _: IpcMainInvokeEvent,

    url: string

): Promise<{ success: boolean; data?: ArrayBuffer; contentType?: string; error?: string; }> {

    if (!isSafeExternalUrl(url)) {
        return { success: false, error: "Refusing to fetch that URL" };
    }

    try {

        const response = await fetch(url);

        if (!response.ok) {

            return { success: false, error: `Fetch failed: ${response.status} ${response.statusText}` };

        }

        const data = await response.arrayBuffer();

        const contentType = response.headers.get("content-type") || "";

        return { success: true, data, contentType };

    } catch (e) {

        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };

    }

}
