/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

type MemoizedFunction<T extends (...args: any[]) => any> = {
    (...args: Parameters<T>): ReturnType<T>;
    clear(): void;
};

// None of this module's 3 callers (messageJsonToMessageClass, parseQuery,
// getAttachmentBlobUrl) ever called .clear() anywhere, and the cache itself
// had no size cap - every distinct JSON.stringify(args) key seen for the
// life of the session stayed cached forever. Worst offender is
// messageJsonToMessageClass: it's called on every render of every
// deleted/edited message with a freshly-merged object each time (see its
// call site in index.tsx's MessageStore.getMessage override), so a long
// session with many logged messages viewed grows this without bound, and
// each entry holds a full constructed Message class instance (content,
// embeds, attachments, author). Evicting the oldest entry past a cap - same
// strategy LimitedMap already uses elsewhere in this plugin - bounds memory
// without ever returning a wrong (stale) result, since a cache miss just
// recomputes.
const MAX_CACHE_SIZE = 500;

// Called with the evicted cache entry's value right before it's dropped, so
// callers whose cached values hold an external resource (getAttachmentBlobUrl
// caches a createObjectURL() blob URL, which otherwise leaks that blob's
// memory for the rest of the session - createObjectURL has no automatic GC,
// only an explicit revokeObjectURL call frees it) can release it instead of
// the eviction just hiding the leak.
export function memoize<T extends (...args: any[]) => any>(func: T, onEvict?: (value: ReturnType<T>) => void): MemoizedFunction<T> {
    const cache = new Map<string, ReturnType<T>>();

    const memoizedFunc = (...args: Parameters<T>): ReturnType<T> => {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key)!;
        }

        const result = func(...args);

        if (cache.size >= MAX_CACHE_SIZE) {
            const oldestKey = cache.keys().next().value!;
            onEvict?.(cache.get(oldestKey)!);
            cache.delete(oldestKey);
        }
        cache.set(key, result);

        return result;
    };

    memoizedFunc.clear = () => cache.clear();

    return memoizedFunc;
}
