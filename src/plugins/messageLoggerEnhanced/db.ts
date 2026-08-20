/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { cacheSentMessages } from "@plugins/messageLoggerEnhanced/index";
import { ChannelStore, Toasts } from "@webpack/common";
import { DBSchema, IDBPDatabase, openDB } from "idb";

import { LoggedMessageJSON } from "./types";
import { getMessageStatus } from "./utils";
import { stripTransientRenderState } from "./utils/cleanUp";
import { DB_NAME, DB_VERSION } from "./utils/constants";
import { getAttachmentBlobUrl } from "./utils/saveImage";

export enum DBMessageStatus {
    DELETED = "DELETED",
    EDITED = "EDITED",
    GHOST_PINGED = "GHOST_PINGED",
}

export interface DBMessageRecord {
    message_id: string;
    channel_id: string;
    status: DBMessageStatus;
    message: LoggedMessageJSON;
}

export interface MLIDB extends DBSchema {
    messages: {
        key: string;
        value: DBMessageRecord;
        indexes: {
            by_channel_id: string;
            by_status: DBMessageStatus;
            by_timestamp: string;
            by_timestamp_and_message_id: [string, string];
        };
    };

}

export let db: IDBPDatabase<MLIDB>;
export const cachedMessages = new Map<string, LoggedMessageJSON>();

// Ids explicitly removed via deleteMessageIDB/deleteMessagesBulkIDB - checked
// by getDeleted/getEdited (index.tsx) BEFORE they even look at what Discord's
// own message-update transformer computed. Discord rebuilds a message's
// deleted/editHistory fields on every MESSAGE_UPDATE/MESSAGE_DELETE by merging
// the previous stored instance with the new incoming data through its own
// minified internal logic - which of those two ends up "winning" isn't
// something we control or can safely assume from the outside. A membership
// check here can't be undermined by that internal merge picking the wrong
// side, unlike mutating the dispatched payload and hoping it's read back out
// correctly. Bounded the same way LimitedMap evicts (oldest id first) so a
// long session doing lots of deletions can't grow this unbounded.
const MAX_PERMANENTLY_REMOVED_IDS = 2000;
export const permanentlyRemovedIds = new Set<string>();
export function markPermanentlyRemoved(message_id: string) {
    permanentlyRemovedIds.add(message_id);
    if (permanentlyRemovedIds.size > MAX_PERMANENTLY_REMOVED_IDS) {
        permanentlyRemovedIds.delete(permanentlyRemovedIds.values().next().value!);
    }
}

// this is probably not the best way to do this
async function cacheRecords(records: DBMessageRecord[]) {
    for (const r of records) {
        cacheRecord(r);

        for (const att of r.message.attachments) {
            const blobUrl = await getAttachmentBlobUrl(att);
            if (blobUrl) {
                att.url = blobUrl + "#";
                att.proxy_url = blobUrl + "#";
            }
        }
    }
    return records;
}

async function cacheRecord(record?: DBMessageRecord | null) {
    if (!record) return record;

    stripTransientRenderState(record.message);
    cachedMessages.set(record.message_id, record.message);
    return record;
}

export async function initIDB() {
    if (db) return;
    db = await openDB<MLIDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            const messageStore = db.createObjectStore("messages", { keyPath: "message_id" });
            messageStore.createIndex("by_channel_id", "channel_id");
            messageStore.createIndex("by_status", "status");
            messageStore.createIndex("by_timestamp", "message.timestamp");
            messageStore.createIndex("by_timestamp_and_message_id", ["channel_id", "message.timestamp"]);
        }
    });
}
initIDB();

export async function hasMessageIDB(message_id: string) {
    return cachedMessages.has(message_id) || (await db.count("messages", message_id)) > 0;
}

export async function countMessagesIDB() {
    return db.count("messages");
}

export async function countMessagesByStatusIDB(status: DBMessageStatus) {
    return db.countFromIndex("messages", "by_status", status);
}

export async function getAllMessagesIDB() {
    return cacheRecords(await db.getAll("messages"));
}

export async function getMessagesForChannelIDB(channel_id: string) {
    return cacheRecords(await db.getAllFromIndex("messages", "by_channel_id", channel_id));
}

export async function getMessageIDB(message_id: string) {
    return cacheRecord(await db.get("messages", message_id));
}

export async function getMessagesByStatusIDB(status: DBMessageStatus) {
    return cacheRecords(await db.getAllFromIndex("messages", "by_status", status));
}

export async function getOldestMessagesIDB(limit: number) {
    return cacheRecords(await db.getAllFromIndex("messages", "by_timestamp", undefined, limit));
}

export async function* iterateAllMessagesIDB(batchSize = 100) {
    let lastId: string | undefined;
    while (true) {
        const batch: DBMessageRecord[] = [];
        // new transaction for each batch to avoid timeouts during yield
        const tx = db.transaction("messages");
        const range = lastId ? IDBKeyRange.lowerBound(lastId, true) : undefined;
        let cursor = await tx.store.openCursor(range);

        while (cursor && batch.length < batchSize) {
            batch.push(cursor.value);
            cursor = await cursor.continue();
        }

        if (batch.length === 0) break;

        lastId = batch[batch.length - 1].message_id;

        yield await cacheRecords(batch);

        if (batch.length < batchSize) break;
    }
}

export async function getOlderThanTimestampIDB(timestamp: string) {
    const tx = db.transaction("messages", "readonly");
    const { store } = tx;
    const index = store.index("by_timestamp");

    const cursor = await index.openCursor(IDBKeyRange.upperBound(timestamp));

    if (!cursor) {
        return [];
    }

    const messages: DBMessageRecord[] = [];
    for await (const c of cursor) {
        messages.push(c.value);
    }

    return cacheRecords(messages);
}

export async function getOlderThanTimestampForGuildsIDB(timestamp: string, currentChannelId?: string, preserveCurrentChannel?: boolean) {
    const allOldMessages = await getOlderThanTimestampIDB(timestamp);
    return allOldMessages.filter(record => {
        const { message } = record;
        const channel = ChannelStore.getChannel(message.channel_id);
        const isGuildMessage = channel?.guild_id != null;
        const isCurrentChannel = preserveCurrentChannel && currentChannelId && message.channel_id === currentChannelId;
        return isGuildMessage && !isCurrentChannel;
    });
}

export async function getDateStortedMessagesByStatusIDB(newest: boolean, limit: number, status: DBMessageStatus) {
    const tx = db.transaction("messages", "readonly");
    const { store } = tx;
    const index = store.index("by_status");

    const direction = newest ? "prev" : "next";
    const cursor = await index.openCursor(IDBKeyRange.only(status), direction);

    if (!cursor) {
        console.log("No messages found");
        return [];
    }

    const messages: DBMessageRecord[] = [];
    for await (const c of cursor) {
        messages.push(c.value);
        if (messages.length >= limit) break;
    }

    return cacheRecords(messages);
}

export async function getMessagesByChannelAndAfterTimestampIDB(channel_id: string, start: string) {
    const tx = db.transaction("messages", "readonly");
    const { store } = tx;
    const index = store.index("by_timestamp_and_message_id");

    const cursor = await index.openCursor(IDBKeyRange.bound([channel_id, start], [channel_id, "\uffff"]));

    if (!cursor) {
        console.log("No messages found in range");
        return [];
    }

    const messages: DBMessageRecord[] = [];
    for await (const c of cursor) {
        messages.push(c.value);
    }

    return cacheRecords(messages);
}

export async function addMessageIDB(message: LoggedMessageJSON, status: DBMessageStatus) {
    // Final backstop, not just belt-and-suspenders: a message a user
    // permanently removed can get logged again by a handler that has no way
    // to know that (e.g. a stray MESSAGE_UPDATE from an embed finishing
    // loading, well after the removal). Blocking the actual write here means
    // no future caller of this function can silently undo a removal, even
    // one added later that forgets to check permanentlyRemovedIds itself.
    if (permanentlyRemovedIds.has(message.id)) return;

    stripTransientRenderState(message);

    if (!db) await initIDB();
    await db.put("messages", {
        channel_id: message.channel_id,
        message_id: message.id,
        status,
        message,
    });

    cachedMessages.set(message.id, message);
}

export async function addMessagesBulkIDB(messages: LoggedMessageJSON[], status?: DBMessageStatus) {
    messages.forEach(stripTransientRenderState);

    const tx = db.transaction("messages", "readwrite");
    const { store } = tx;

    // put(), not add() - addMessageIDB (the single-message version) already
    // upserts via put(); this used add(), which throws ConstraintError on
    // any message_id already present in the store. IDB aborts the WHOLE
    // transaction on an unhandled error from one of its requests, so a
    // single duplicate anywhere in the batch (e.g. re-importing a log file
    // that overlaps with messages logged normally, or a malformed export
    // with a repeated id) would silently lose every other message in that
    // same batch too, not just the duplicate one.
    await Promise.all([
        ...messages.map(message => store.put({
            channel_id: message.channel_id,
            message_id: message.id,
            status: status ?? getMessageStatus(message),
            message,
        })),
        tx.done
    ]);

    messages.forEach(message => cachedMessages.set(message.id, message));
}

export async function deleteMessageIDB(channel_id: string, message_id: string) {
    await db.delete("messages", message_id);

    cachedMessages.delete(message_id);
    markPermanentlyRemoved(message_id);

    // cacheSentMessages (index.tsx) is a completely separate, longer-lived
    // cache of recently-seen message content/editHistory, keyed by
    // "channel_id,message_id" - never touched above. Left stale, it's a
    // resurrection vector: messageUpdateHandler falls back to it whenever
    // MessageStore doesn't have this message cached (common after a reload,
    // before scrolling back to it), and rebuilds a fresh editHistory by
    // appending onto whatever it finds there - including the exact entries
    // this call was supposed to permanently remove - the next time Discord
    // fires ANY MESSAGE_UPDATE for this message (e.g. an embed/link preview
    // finishing loading, which very commonly happens right after a reload).
    cacheSentMessages.delete(`${channel_id},${message_id}`);
}

export async function deleteMessagesBulkIDB(records: { channel_id: string; message_id: string; }[]) {
    const tx = db.transaction("messages", "readwrite");
    const { store } = tx;

    await Promise.all([...records.map(r => store.delete(r.message_id)), tx.done]);

    // Same cacheSentMessages resurrection risk as deleteMessageIDB above,
    // just for every bulk-clear path (Clear Visible/All Logs, time-based
    // cleanup, the messageLimit trim) - all 3 call sites already have the
    // channel_id on hand via the records they're deleting, so there's no
    // reason for this to have stayed string-id-only and missed the same fix.
    for (const { channel_id, message_id } of records) {
        cachedMessages.delete(message_id);
        cacheSentMessages.delete(`${channel_id},${message_id}`);
        markPermanentlyRemoved(message_id);
    }
}

export async function clearMessagesIDB(showToast = true) {
    cachedMessages.clear();
    await db.clear("messages");
    if (!showToast) return;

    Toasts.show({
        type: Toasts.Type.MESSAGE,
        message: "Cleared message log database and cache.",
        id: Toasts.genId()
    });
}
