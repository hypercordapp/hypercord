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

import ErrorBoundary from "@components/ErrorBoundary";
import BadgeAPIPlugin from "@plugins/_api/badges";
import { ComponentType, HTMLProps } from "react";

export const enum BadgePosition {
    START,
    END
}

export interface ProfileBadge {
    /**
     * Badge id, unused by vencord, required by discord
     */
    id: string,
    /** The tooltip to show on hover. Required for image badges */
    description?: string;
    /** Custom component for the badge (tooltip not included) */
    component?: ComponentType<ProfileBadge & BadgeUserArgs>;
    /** The custom image to use */
    iconSrc?: string;
    link?: string;
    /** Action to perform when you click the badge */
    onClick?(event: React.MouseEvent, props: ProfileBadge & BadgeUserArgs): void;
    /** Action to perform when you right click the badge */
    onContextMenu?(event: React.MouseEvent, props: BadgeUserArgs & BadgeUserArgs): void;
    /** Should the user display this badge? */
    shouldShow?(userInfo: BadgeUserArgs): boolean;
    /** Optional props (e.g. style) for the badge, ignored for component badges */
    props?: HTMLProps<HTMLImageElement>;
    /** Insert at start or end? */
    position?: BadgePosition;
    /** The badge name to display, Discord uses this. Required for component badges */
    key?: string;

    /**
     * Allows dynamically returning multiple badges.
     * Must not call hooks
     */
    getBadges?(userInfo: BadgeUserArgs): ProfileBadge[];
}

const Badges = new Set<ProfileBadge>();

/**
 * Register a new badge with the Badges API
 * @param badge The badge to register
 */
export function addProfileBadge(badge: ProfileBadge) {
    badge.component &&= ErrorBoundary.wrap(badge.component, { noop: true });
    Badges.add(badge);
}

/**
 * Unregister a badge from the Badges API
 * @param badge The badge to remove
 */
export function removeProfileBadge(badge: ProfileBadge) {
    return Badges.delete(badge);
}

/**
 * Inject badges into the profile badges array.
 * You probably don't need to use this.
 */
export function _getBadges(args: BadgeUserArgs) {
    const badges = [] as ProfileBadge[];
    // Held back and pushed right next to donor/custom below instead of mixed
    // into the generic Set order - otherwise other plugins that also use
    // BadgePosition.START (e.g. platformIndicators) can end up unshifted in
    // between it and our own donor/custom badges depending on plugin start
    // order, which reads as "random" instead of grouped together.
    let contributorBadge: ProfileBadge | undefined;

    for (const badge of Badges) {
        if (badge.shouldShow && !badge.shouldShow(args)) {
            continue;
        }

        const b = badge.getBadges
            ? badge.getBadges(args).map(badge => ({
                ...args,
                ...badge,
                component: badge.component && ErrorBoundary.wrap(badge.component, { noop: true })
            }))
            : [{ ...args, ...badge }];

        if (badge.id === "hypercord_contributor_badge") {
            contributorBadge = b[0];
            continue;
        }

        if (badge.position === BadgePosition.START) {
            badges.unshift(...b);
        } else {
            badges.push(...b);
        }
    }

    if (contributorBadge) badges.push(contributorBadge);

    // Appended, not unshifted: these are HyperCord additions layered on top of
    // Vencord's own badge Set above, and this whole array gets spliced in
    // right before Discord's *own* real badges (Nitro, Staff, HypeSquad...)
    // by the patch in _api/badges - unshifting here would put fake badges
    // ahead of real ones within our own group too, on top of that.
    const donorBadges = BadgeAPIPlugin.getDonorBadges(args.userId);
    if (donorBadges) {
        badges.push(
            ...donorBadges.map(badge => ({
                ...args,
                ...badge,
            }))
        );
    }

    const customBadges = BadgeAPIPlugin.getCustomBadges(args.userId);
    if (customBadges) {
        badges.push(
            ...customBadges.map(badge => ({
                ...args,
                ...badge,
            }))
        );
    }

    return badges;
}

export interface BadgeUserArgs {
    userId: string;
    guildId: string;
}
