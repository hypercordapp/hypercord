/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { randomUUID } from "node:crypto";
import { FileHandle, open } from "node:fs/promises";

import { dialog, IpcMainInvokeEvent } from "electron";

const activeFiles = new Map<string, FileHandle>();

export async function startNativeLogImport(_event: IpcMainInvokeEvent, defaultPath?: string) {
    const res = await dialog.showOpenDialog({
        title: "Import Logs",
        filters: [{ name: "Logs", extensions: ["json"] }],
        properties: ["openFile"],
        defaultPath
    });
    const [path] = res.filePaths;

    if (!path) throw Error("No file selected");

    const fileHandle = await open(path, "r");
    const fileId = randomUUID();
    activeFiles.set(fileId, fileHandle);

    return fileId;
}

const MAX_CHUNK_SIZE = 8 * 1024 * 1024;

export async function readNativeLogChunk(_event: IpcMainInvokeEvent, fileId: string, size: number = 64 * 1024): Promise<string | null> {
    const fileHandle = activeFiles.get(fileId);
    if (!fileHandle) return null;

    // Native plugin IPC methods are exposed to ANY renderer script regardless
    // of call site - size was passed straight into Buffer.alloc() with no
    // upper bound, so a caller other than this plugin's own reader (which
    // always uses the 64KB default) could pass an arbitrary huge size and
    // force a large allocation in the main process - clamp it.
    const clampedSize = Math.min(Math.max(size, 1), MAX_CHUNK_SIZE);
    const buffer = Buffer.alloc(clampedSize);
    const { bytesRead } = await fileHandle.read(buffer, 0, clampedSize);

    if (bytesRead === 0) {
        await fileHandle.close();
        activeFiles.delete(fileId);
        return null;
    }

    return buffer.toString("utf-8", 0, bytesRead);
}

export async function closeNativeLogImport(_event: IpcMainInvokeEvent, fileId: string) {
    const fileHandle = activeFiles.get(fileId);
    if (fileHandle) {
        await fileHandle.close();
        activeFiles.delete(fileId);
    }
}
