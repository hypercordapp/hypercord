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

import { Logger } from "@utils/Logger";
import { Menu, React } from "@webpack/common";
import type { ReactElement } from "react";

/**
 * @param children The rendered context menu elements
 * @param args Any arguments passed into making the context menu, like the guild, channel, user or message for example
 */
export type NavContextMenuPatchCallback = (children: Array<ReactElement<any> | null>, ...args: Array<any>) => void;
/**
 * @param navId The navId of the context menu being patched
 * @param children The rendered context menu elements
 * @param args Any arguments passed into making the context menu, like the guild, channel, user or message for example
 */
export type GlobalContextMenuPatchCallback = (navId: string, children: Array<ReactElement<any> | null>, ...args: Array<any>) => void;

const ContextMenuLogger = new Logger("ContextMenu");

export const navPatches = new Map<string, Set<NavContextMenuPatchCallback>>();
export const globalPatches = new Set<GlobalContextMenuPatchCallback>();

/**
 * Add a context menu patch
 * @param navId The navId(s) for the context menu(s) to patch
 * @param patch The patch to be applied
 */
export function addContextMenuPatch(navId: string | Array<string>, patch: NavContextMenuPatchCallback) {
    if (!Array.isArray(navId)) navId = [navId];
    for (const id of navId) {
        let contextMenuPatches = navPatches.get(id);
        if (!contextMenuPatches) {
            contextMenuPatches = new Set();
            navPatches.set(id, contextMenuPatches);
        }

        contextMenuPatches.add(patch);
    }
}

/**
 * Add a global context menu patch that fires the patch for all context menus
 * @param patch The patch to be applied
 */
export function addGlobalContextMenuPatch(patch: GlobalContextMenuPatchCallback) {
    globalPatches.add(patch);
}

/**
 * Remove a context menu patch
 * @param navId The navId(s) for the context menu(s) to remove the patch
 * @param patch The patch to be removed
 * @returns Whether the patch was successfully removed from the context menu(s)
 */
export function removeContextMenuPatch<T extends string | Array<string>>(navId: T, patch: NavContextMenuPatchCallback): T extends string ? boolean : Array<boolean> {
    const navIds: string[] = Array.isArray(navId) ? navId : [navId];

    const results = navIds.map(id => navPatches.get(id)?.delete(patch) ?? false);

    return (Array.isArray(navId) ? results : results[0]) as T extends string ? boolean : Array<boolean>;
}

/**
 * Remove a global context menu patch
 * @param patch The patch to be removed
 * @returns Whether the patch was successfully removed
 */
export function removeGlobalContextMenuPatch(patch: GlobalContextMenuPatchCallback): boolean {
    return globalPatches.delete(patch);
}

/**
 * A helper function for finding the children array of a group nested inside a context menu based on the id(s) of its children
 * @param id The id of the child. If an array is specified, all ids will be tried
 * @param children The context menu children
 * @param matchSubstring Whether to check if the id is a substring of the child id
 */
export function findGroupChildrenByChildId(id: string | string[], children: Array<ReactElement<any> | null | undefined>, matchSubstring = false): Array<ReactElement<any> | null | undefined> | null {
    for (const child of children) {
        if (child == null || !React.isValidElement(child)) continue;

        if (Array.isArray(child)) {
            const found = findGroupChildrenByChildId(id, child, matchSubstring);
            if (found !== null) return found;
        }

        const childId = (child.props as any)?.id;
        if (
            (Array.isArray(id) && id.some(targetId => matchSubstring ? childId?.includes(targetId) : childId === targetId))
            || (matchSubstring ? childId?.includes(id as string) : childId === id)
        ) {
            return children;
        }

        const nextChildren = (child.props as any)?.children;
        if (nextChildren && typeof nextChildren !== "function") {
            if (Array.isArray(nextChildren)) {
                const found = findGroupChildrenByChildId(id, nextChildren, matchSubstring);
                if (found !== null) return found;
            }
        }
    }

    return null;
}

interface ContextMenuProps {
    contextMenuAPIArguments?: Array<any>;
    navId: string;
    children: Array<ReactElement<any> | null>;
    "aria-label": string;
    onSelect: (() => void) | undefined;
    onClose: (callback: (...args: Array<any>) => any) => void;
}

export function _usePatchContextMenu(props: ContextMenuProps) {
    if (!Menu.MenuItem) return props;

    props = {
        ...props,
        children: cloneMenuChildren(props.children),
    };

    const rawArgs = props.contextMenuAPIArguments ?? [];
    const patchArgs = rawArgs.length && rawArgs[0] != null ? rawArgs : [{}, ...rawArgs.slice(1)];
    const contextMenuPatches = navPatches.get(props.navId);

    if (!Array.isArray(props.children)) props.children = [props.children];

    if (contextMenuPatches) {
        for (const patch of contextMenuPatches) {
            try {
                patch(props.children, ...patchArgs);
            } catch (err) {
                ContextMenuLogger.error(`Patch for ${props.navId} errored,`, err);
            }
        }
    }

    for (const patch of globalPatches) {
        try {
            patch(props.navId, props.children, ...patchArgs);
        } catch (err) {
            ContextMenuLogger.error("Global patch errored,", err);
        }
    }

    // Normalize context menu structure:
    // 1. Remove nulls and empty MenuGroups
    // 2. Group any loose top-level MenuItems into a single MenuGroup to avoid multiple divider lines and ensure proper keyboard navigation
    if (Array.isArray(props.children)) {
        const normalizedChildren: Array<ReactElement<any> | null> = [];
        let looseGroup: Array<ReactElement<any>> = [];

        const flushLooseGroup = () => {
            if (looseGroup.length > 0) {
                normalizedChildren.push(
                    React.createElement(Menu.MenuGroup, { key: `hc-loose-group-${normalizedChildren.length}` }, ...looseGroup)
                );
                looseGroup = [];
            }
        };

        for (const child of props.children) {
            if (child == null) continue;
            if (React.isValidElement(child)) {
                if (child.type === Menu.MenuGroup) {
                    const groupChildren = (child.props as any)?.children;
                    const hasChildren = Array.isArray(groupChildren)
                        ? groupChildren.some(c => c != null && React.isValidElement(c))
                        : groupChildren != null && React.isValidElement(groupChildren);

                    if (hasChildren) {
                        flushLooseGroup();
                        normalizedChildren.push(child);
                    }
                } else {
                    looseGroup.push(child);
                }
            }
        }

        flushLooseGroup();
        props.children = normalizedChildren;
    }

    return props;
}

function cloneMenuChildren(children: any): any {
    if (!children) return children;

    if (Array.isArray(children)) {
        return children.map(child => {
            if (!child || !React.isValidElement(child)) return child;
            if (child.type === Menu.MenuGroup) {
                const groupChildren = (child.props as any)?.children;
                if (Array.isArray(groupChildren)) {
                    return React.cloneElement(child as ReactElement<any>, {
                        children: [...groupChildren]
                    });
                } else if (groupChildren && React.isValidElement(groupChildren)) {
                    return React.cloneElement(child as ReactElement<any>, {
                        children: [groupChildren]
                    });
                }
                return React.cloneElement(child as ReactElement<any>, { children: [] });
            }
            return child;
        });
    } else if (React.isValidElement(children) && children.type === Menu.MenuGroup) {
        const groupChildren = (children as any).props?.children;
        return [
            React.cloneElement(children as ReactElement<any>, {
                children: Array.isArray(groupChildren) ? [...groupChildren] : groupChildren ? [groupChildren] : []
            })
        ];
    }

    return children;
}
