/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LiteralUnion } from "type-fest";

export const SYM_IS_PROXY = Symbol("SettingsStore.isProxy");
export const SYM_GET_RAW_TARGET = Symbol("SettingsStore.getRawTarget");

// A value assigned into the store can itself contain (possibly nested, e.g.
// inside a plain array or object spread) references that were READ off this
// same Proxy elsewhere - each of those is its own live Proxy (see the get
// trap below, which wraps every object-typed property on the way out).
// A one-off shallow unwrap only ever caught the case where the assigned
// value itself was a proxy; anything holding one a level or more down (e.g.
// `settings.store.list = [...settings.store.list.map(x => x)]` without every
// caller manually re-plaining each element) stayed a live Proxy inside what
// is supposed to be `this.plain` - a tree that has to be a real, structured-
// cloneable JS value, since it round-trips through Electron's contextBridge
// IPC (structuredClone, which throws "An object could not be cloned" on a
// Proxy) on every single settings change, not just the one that planted it.
// Once that throw happens, the bad value is already sitting in `this.plain`
// (Reflect.set already ran) and stays there for the rest of the session -
// so from that point on, EVERY future setting change anywhere in the app
// hits the same throw before its listeners (persistence + re-render) ever
// run, even though the in-memory value did update. Live-confirmed via crash
// reports: a plugin's own "rebuild a plain array/object before assigning
// back" pattern missed a nested proxy, and every later click of an unrelated
// "Add" button in that same picker looked like it silently did nothing while
// actually appending to the real underlying list each time - hence "adding
// one connection produced hundreds of duplicates" reports, since the picker
// never got a chance to re-render and warn anyone something was wrong.
// Deep-unwrapping here, once, for every write, closes this for every current
// and future settings write in the app instead of relying on each call site
// remembering to fully re-plain a value it read back off the store.
function deepUnwrapProxies(value: any): any {
    if (value == null || typeof value !== "object") return value;

    if (value[SYM_IS_PROXY]) value = value[SYM_GET_RAW_TARGET];

    if (Array.isArray(value)) return value.map(deepUnwrapProxies);

    // Only flatten plain data objects - anything else (Date, RegExp, a class
    // instance, etc.) is left untouched, matching what settings are actually
    // expected to hold (JSON-serializable data), same assumption the disk
    // persistence path (JSON.stringify) already makes.
    if (value.constructor === Object) {
        const out: Record<string, any> = {};
        for (const key of Object.keys(value)) out[key] = deepUnwrapProxies(value[key]);
        return out;
    }

    return value;
}

// Resolves a possibly nested prop in the form of "some.nested.prop" to type of T.some.nested.prop
type ResolvePropDeep<T, P> =
    P extends `${infer Pre}.*` ?
    Pre extends keyof T
    ? T[Pre][keyof T[Pre]]
    : any
    : P extends `${infer Pre}.${infer Suf}`
    ? Pre extends keyof T
    ? ResolvePropDeep<T[Pre], Suf>
    : any
    : P extends keyof T
    ? T[P]
    : any;

interface SettingsStoreOptions {
    readOnly?: boolean;
    getDefaultValue?: (data: {
        target: any;
        key: string;
        root: any;
        path: string;
    }) => any;
}

// merges the SettingsStoreOptions type into the class
export interface SettingsStore<T extends object> extends SettingsStoreOptions { }

interface ProxyContext<T extends object = any> {
    root: T;
    path: string;
}

/**
 * The SettingsStore allows you to easily create a mutable store that
 * has support for global and path-based change listeners.
 */
export class SettingsStore<T extends object> {
    private pathListeners = new Map<string, Set<(newData: any) => void>>();
    private prefixListeners = new Map<string, Set<(newData: any, path: string) => void>>();
    private globalListeners = new Set<(newData: T, path: string) => void>();
    private readonly proxyContexts = new WeakMap<any, ProxyContext<T>>();

    private readonly proxyHandler: ProxyHandler<any> = (() => {
        const self = this;

        return {
            get(target, key: any, receiver) {
                if (key === SYM_IS_PROXY) {
                    return true;
                }

                if (key === SYM_GET_RAW_TARGET) {
                    return target;
                }

                let v = Reflect.get(target, key, receiver);

                const proxyContext = self.proxyContexts.get(target);
                if (proxyContext == null) {
                    return v;
                }

                const { root, path } = proxyContext;

                if (!(key in target) && self.getDefaultValue != null) {
                    v = self.getDefaultValue({
                        target,
                        key,
                        root,
                        path
                    });
                }

                if (typeof v === "object" && v !== null && !v[SYM_IS_PROXY]) {
                    const getPath = `${path}${path && "."}${key}`;
                    return self.makeProxy(v, root, getPath);
                }

                return v;
            },
            set(target, key: string, value) {
                value = deepUnwrapProxies(value);

                if (target[key] === value) {
                    return true;
                }

                if (!Reflect.set(target, key, value)) {
                    return false;
                }

                const proxyContext = self.proxyContexts.get(target);
                if (proxyContext == null) {
                    return true;
                }

                const { root, path } = proxyContext;

                const setPath = `${path}${path && "."}${key}`;
                self.notifyListeners(setPath, value, root);

                return true;
            },
            deleteProperty(target, key: string) {
                if (!Reflect.deleteProperty(target, key)) {
                    return false;
                }

                const proxyContext = self.proxyContexts.get(target);
                if (proxyContext == null) {
                    return true;
                }

                const { root, path } = proxyContext;

                const deletePath = `${path}${path && "."}${key}`;
                self.notifyListeners(deletePath, undefined, root);

                return true;
            }
        };
    })();

    /**
     * The store object. Making changes to this object will trigger the applicable change listeners
     */
    public declare store: T;
    /**
     * The plain data. Changes to this object will not trigger any change listeners
     */
    public declare plain: T;

    public constructor(plain: T, options: SettingsStoreOptions = {}) {
        this.plain = plain;
        this.store = this.makeProxy(plain);
        Object.assign(this, options);
    }

    private makeProxy(object: any, root: T = object, path = "") {
        this.proxyContexts.set(object, {
            root,
            path
        });

        return new Proxy(object, this.proxyHandler);
    }

    private notifyPrefixListeners(pathString: string, pathElements: string[], value: any) {
        for (let i = 1; i <= pathElements.length; i++) {
            const prefix = pathElements.slice(0, i).join(".");
            this.prefixListeners.get(prefix)?.forEach(cb => cb(value, pathString));
        }
    }

    private notifyListeners(pathStr: string, value: any, root: T) {
        const paths = pathStr.split(".");

        // Because we support any type of settings with OptionType.CUSTOM, and those objects get proxied recursively,
        // the path ends up including all the nested paths (plugins.pluginName.settingName.example.one).
        // So, we need to extract the top-level setting path (plugins.pluginName.settingName),
        // to be able to notify globalListeners and top-level setting name listeners (let { settingName } = settings.use(["settingName"]),
        // with the new value
        if (paths.length > 3 && paths[0] === "plugins") {
            const settingPath = paths.slice(0, 3);
            const settingPathStr = settingPath.join(".");
            const settingValue = settingPath.reduce((acc, curr) => acc[curr], root);

            this.globalListeners.forEach(cb => cb(root, settingPathStr));
            this.pathListeners.get(settingPathStr)?.forEach(cb => cb(settingValue));
        } else {
            this.globalListeners.forEach(cb => cb(root, pathStr));
        }

        this.pathListeners.get(pathStr)?.forEach(cb => cb(value));
        this.notifyPrefixListeners(pathStr, paths, value);
    }

    /**
     * Set the data of the store.
     * This will update this.store and this.plain (and old references to them will be stale! Avoid storing them in variables)
     *
     * Additionally, all global listeners (and those for pathToNotify, if specified) will be called with the new data
     * @param value New data
     * @param pathToNotify Optional path to notify instead of globally. Used to transfer path via ipc
     */
    public setData(value: T, pathToNotify?: string) {
        if (this.readOnly) throw new Error("SettingsStore is read-only");

        this.plain = value;
        this.store = this.makeProxy(value);

        if (pathToNotify) {
            let v = value;

            const path = pathToNotify.split(".");
            for (const p of path) {
                if (!v) {
                    console.warn(
                        `Settings#setData: Path ${pathToNotify} does not exist in new data. Not dispatching update`
                    );
                    return;
                }
                v = v[p];
            }

            this.pathListeners.get(pathToNotify)?.forEach(cb => cb(v));
            this.notifyPrefixListeners(pathToNotify, path, v);
        }

        this.markAsChanged();
    }

    /**
     * Add a global change listener, that will fire whenever any setting is changed
     *
     * @param data The new data. This is either the new value set on the path, or the new root object if it was changed
     * @param path The path of the setting that was changed. Empty string if the root object was changed
     */
    public addGlobalChangeListener(cb: (data: any, path: string) => void) {
        this.globalListeners.add(cb);
    }

    /**
     * Add a scoped change listener that will fire whenever a setting matching the specified path is changed.
     *
     * For example if path is `"foo.bar"`, the listener will fire on
     * ```js
     * Setting.store.foo.bar = "hi"
     * ```
     * but not on
     * ```js
     * Setting.store.foo.baz = "hi"
     * ```
     */
    public addChangeListener<P extends LiteralUnion<keyof T, string>>(
        path: P,
        cb: (data: ResolvePropDeep<T, P>) => void
    ) {
        const listeners = this.pathListeners.get(path as string) ?? new Set();
        listeners.add(cb);
        this.pathListeners.set(path as string, listeners);
    }

    /**
     * Add a prefix change listener that will fire whenever a setting matching the specified prefix is changed.
     * For example if prefix is `"foo"`, the listener will fire on
     * ```js
     * Setting.store.foo.bar = "hi"
     * Setting.store.foo.baz = "hi"
     * ```
     */
    public addPrefixChangeListener<P extends string>(prefix: P, cb: (data: ResolvePropDeep<T, P>, path: string) => void) {
        const listeners = this.prefixListeners.get(prefix) ?? new Set();
        listeners.add(cb);
        this.prefixListeners.set(prefix, listeners);
    }

    /**
     * Remove a global listener
     * @see {@link addGlobalChangeListener}
     */
    public removeGlobalChangeListener(cb: (data: any, path: string) => void) {
        this.globalListeners.delete(cb);
    }

    /**
     * Remove a scoped listener
     * @see {@link addChangeListener}
     */
    public removeChangeListener(path: LiteralUnion<keyof T, string>, cb: (data: any) => void) {
        const listeners = this.pathListeners.get(path as string);
        if (!listeners) return;

        listeners.delete(cb);
        if (!listeners.size) this.pathListeners.delete(path as string);
    }

    /**
     * Remove a prefix listener
     * @see {@link addPrefixChangeListener}
     */
    public removePrefixChangeListener(prefix: string, cb: (data: any, path: string) => void) {
        const listeners = this.prefixListeners.get(prefix);
        if (!listeners) return;

        listeners.delete(cb);
        if (!listeners.size) this.prefixListeners.delete(prefix);
    }

    /**
     * Call all global change listeners
     */
    public markAsChanged() {
        this.globalListeners.forEach(cb => cb(this.plain, ""));
    }
}
