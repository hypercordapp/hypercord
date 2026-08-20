/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { ensureSafePath } from "@main/ipcMain";
import { DATA_DIR } from "@main/utils/constants";
import { dialog, IpcMainInvokeEvent, shell } from "electron";

import { getSettings, saveSettings } from "./settings";
export * from "./export";
export * from "./import";

import { blockedExts } from "@plugins/messageLoggerEnhanced/list";
import { LoggedAttachment } from "@plugins/messageLoggerEnhanced/types";
import { DEFAULT_ATTACHMENT_FILE_EXTENSIONS, LOGS_DATA_FILENAME } from "@plugins/messageLoggerEnhanced/utils/constants";

import { ensureDirectoryExists, getAttachmentIdFromFilename, sleep } from "./utils";

export { getSettings };
export function messageLoggerEnhancedUniqueIdThingyIdkMan() { }

const nativeSavedImages = new Map<string, string>();
export const getNativeSavedImages = () => nativeSavedImages;

let logsDir: string;
let imageCacheDir: string;

const getImageCacheDir = async () => imageCacheDir ?? await getDefaultNativeImageDir();
const getLogsDir = async () => logsDir ?? await getDefaultNativeDataDir();

export async function initDirs() {
    const { logsDir: ld, imageCacheDir: icd } = await getSettings();

    logsDir = ld || await getDefaultNativeDataDir();
    imageCacheDir = icd || await getDefaultNativeImageDir();
}
initDirs();

export async function init(_event: IpcMainInvokeEvent) {
    const imageDir = await getImageCacheDir();

    await ensureDirectoryExists(imageDir);
    const files = await readdir(imageDir);
    for (const filename of files) {
        const attachmentId = getAttachmentIdFromFilename(filename);
        nativeSavedImages.set(attachmentId, path.join(imageDir, filename));
    }
}

export async function getImageNative(_event: IpcMainInvokeEvent, attachmentId: string): Promise<Uint8Array | Buffer | null> {
    const imagePath = nativeSavedImages.get(attachmentId);
    if (!imagePath) return null;

    try {
        return await readFile(imagePath);
    } catch (error: any) {
        console.error(error);
        return null;
    }
}

export async function writeImageNative(_event: IpcMainInvokeEvent, filename: string, content: Uint8Array) {
    if (!filename || !content) return;
    const imageDir = await getImageCacheDir();
    const attachmentId = getAttachmentIdFromFilename(filename);

    const existingImage = nativeSavedImages.get(attachmentId);
    if (existingImage) return;

    // Native plugin IPC methods are exposed to ANY renderer script regardless
    // of call site (VencordNative.pluginHelpers.*), same reasoning already
    // applied to every other main-process file-write/fetch handler in this
    // codebase - filename was joined into imageDir completely unvalidated,
    // so a "../../../../somewhere/evil.dll"-shaped filename would write
    // outside imageDir entirely, an arbitrary-file-write primitive from the
    // renderer. attachmentId (derived just above via path.parse().name,
    // which strips any directory components) is already what's used as the
    // cache key - use it for the actual path too instead of raw filename.
    const imagePath = ensureSafePath(imageDir, `${attachmentId}${path.extname(filename)}`);
    if (!imagePath) return;

    await ensureDirectoryExists(imageDir);
    await writeFile(imagePath, content);

    nativeSavedImages.set(attachmentId, imagePath);
}

export async function deleteFileNative(_event: IpcMainInvokeEvent, attachmentId: string) {
    const imagePath = nativeSavedImages.get(attachmentId);
    if (!imagePath) return;

    await unlink(imagePath);
}

export async function writeLogs(_event: IpcMainInvokeEvent, contents: string) {
    const logsDir = await getLogsDir();

    writeFile(path.join(logsDir, LOGS_DATA_FILENAME), contents);
}

export async function getDefaultNativeImageDir(): Promise<string> {
    return path.join(await getDefaultNativeDataDir(), "savedImages");
}

export async function getDefaultNativeDataDir(): Promise<string> {
    return path.join(DATA_DIR, "MessageLoggerData");
}

export async function getDefaultAttachmentFileExtensions(): Promise<string> {
    return DEFAULT_ATTACHMENT_FILE_EXTENSIONS;
}

export async function chooseDir(event: IpcMainInvokeEvent, logKey: "logsDir" | "imageCacheDir") {
    const settings = await getSettings();
    const defaultPath = settings[logKey] || await getDefaultNativeDataDir();

    const res = await dialog.showOpenDialog({ properties: ["openDirectory"], defaultPath: defaultPath });
    const dir = res.filePaths[0];

    if (!dir) throw Error("Invalid Directory");

    settings[logKey] = dir;

    await saveSettings(settings);

    switch (logKey) {
        case "logsDir": logsDir = dir; break;
        case "imageCacheDir": imageCacheDir = dir; break;
    }

    if (logKey === "imageCacheDir")
        await init(event);

    return dir;
}

export async function showItemInFolder(_event: IpcMainInvokeEvent) {
    shell.showItemInFolder(await getImageCacheDir());
}

export async function chooseFile(_event: IpcMainInvokeEvent, title: string, filters: Electron.FileFilter[], defaultPath?: string) {
    const res = await dialog.showOpenDialog({ title, filters, properties: ["openFile"], defaultPath });
    const [path] = res.filePaths;

    if (!path) throw Error("Invalid file");

    return await readFile(path, "utf-8");
}

export async function downloadAttachment(_event: IpcMainInvokeEvent, attachment: LoggedAttachment, attempts = 0, useOldUrl = false): Promise<{ error: string | null; path: string | null; }> {
    try {
        if (!attachment?.url || !attachment.oldUrl || !attachment?.id)
            return { error: "Invalid Attachment", path: null };

        if (attachment.id.match(/[\\/.]/)) {
            return { error: "Invalid Attachment ID", path: null };
        }

        const settings = await getSettings();
        const allowedExtensionsStr = settings.attachmentFileExtensions?.trim() || "";
        if (allowedExtensionsStr === "" || allowedExtensionsStr.toLowerCase() === "none") {
            return { error: "All attachment downloads are currently blocked by settings configurations.", path: null };
        }

        const allowedList = allowedExtensionsStr.split(",").map((ext: string) => ext.trim().toLowerCase());
        const cleanExt = attachment.fileExtension?.replace(".", "").toLowerCase();

        if (!cleanExt || !allowedList.includes(cleanExt)) {
            return { error: `File type .${cleanExt} is blocked by settings configurations.`, path: null };
        }

        const existingImage = nativeSavedImages.get(attachment.id);
        if (existingImage)
            return {
                error: null,
                path: existingImage
            };

        const res = await fetch(useOldUrl ? attachment.oldUrl : attachment.url);

        if (res.status !== 200) {
            if (res.status === 404 || res.status === 403 || res.status === 415)
                useOldUrl = true;

            attempts++;
            if (attempts > 3) {
                return {
                    error: `Failed to get attachment ${attachment.id} for caching. too many attempts, error code ${res.status}`,
                    path: null,
                };
            }

            await sleep(1000);
            return downloadAttachment(_event, attachment, attempts, useOldUrl);
        }

        const ab = await res.arrayBuffer();
        const imageCacheDir = await getImageCacheDir();
        await ensureDirectoryExists(imageCacheDir);

        // attachment.id is checked above, but attachment.fileExtension never
        // was - same arbitrary-file-write shape writeImageNative already
        // guards against in this file (a "/../../evil" fileExtension would
        // join outside imageCacheDir). In practice the allowedList check
        // above rejects most malformed extensions first, but that's
        // incidental - guard the actual write directly instead of relying
        // on an unrelated allowlist to keep doing it by accident.
        const finalPath = ensureSafePath(imageCacheDir, `${attachment.id}${attachment.fileExtension}`);
        if (!finalPath) return { error: "Invalid Attachment", path: null };
        await writeFile(finalPath, Buffer.from(ab));

        nativeSavedImages.set(attachment.id, finalPath);

        return {
            error: null,
            path: finalPath
        };

    } catch (error: any) {
        console.error(error);
        return { error: error.message, path: null };
    }
}

export async function updateAllowedExtensions(_event: IpcMainInvokeEvent, cleanExtensionsString: string | undefined) {
    const settings = await getSettings();
    const incomingRaw = cleanExtensionsString?.trim() || "";

    if (incomingRaw === "") {
        settings.attachmentFileExtensions = "none";
        await saveSettings(settings);
        return;
    }

    const validatedExtensions = incomingRaw
        .split(",")
        .map(ext => ext.trim().toLowerCase())
        .filter(ext => ext.length > 0 && !blockedExts.includes(ext));

    if (validatedExtensions.length === 0) {
        settings.attachmentFileExtensions = "none";
    } else {
        settings.attachmentFileExtensions = validatedExtensions.join(",");
    }

    await saveSettings(settings);
}
