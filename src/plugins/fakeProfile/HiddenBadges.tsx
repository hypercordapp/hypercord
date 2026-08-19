/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@i18n";
import { classNameFactory } from "@utils/css";
import { fetchUserProfile } from "@utils/discord";
import { Checkbox, Forms, Text, useEffect, UserStore, useState } from "@webpack/common";

import { getRealBadgesUnfiltered, settings, syncHiddenBadgesToBackend } from ".";

const cl = classNameFactory("vc-fakeprofile-");

interface HideableBadge {
    key: string;
    label: string;
    iconSrc: string;
}

// Only real, Discord-issued badges (Quest Completed, seasonal event badges,
// HypeSquad, Bug Hunter, etc.) - fetched fresh from the user's own real
// profile, keyed by Discord's own stable badge type id. HyperCord's own
// admin-added custom badges (a personally-labeled donor badge, the HyperCord
// donor badge, etc.) are deliberately NOT offered here - explicitly reported
// wrong by the user (those are "special" HyperCord badges, not "real"
// Discord ones, and don't belong in this category at all), even though an
// earlier version of this picker did include them via
// BadgeAPIPlugin.getHideableAdminBadges (since removed).
export function HiddenBadgesPicker() {
    const [badges, setBadges] = useState<HideableBadge[] | null>(null);

    useEffect(() => {
        (async () => {
            const myId = UserStore.getCurrentUser()?.id;
            if (!myId) return;

            // fetchUserProfile's own return value goes through the SAME
            // hiddenRealBadges-filtered getter this picker exists to let you
            // undo, so it can never be used to populate this list (a hidden
            // badge would never come back as a checkbox) - only called here
            // to make sure the store has fetched/cached this id at all.
            // getRealBadgesUnfiltered then reads the real, un-hidden list
            // straight from that same cache.
            await fetchUserProfile(myId);
            const realBadges: HideableBadge[] = (getRealBadgesUnfiltered(myId) ?? []).map(b => ({
                key: b.id,
                label: b.description,
                iconSrc: `https://cdn.discordapp.com/badge-icons/${b.icon}.png`
            }));

            setBadges(realBadges);
        })();
    }, []);

    const hidden = new Set(settings.store.hiddenRealBadges);

    function toggle(key: string, hide: boolean) {
        const current = settings.store.hiddenRealBadges;
        settings.store.hiddenRealBadges = hide ? [...current, key] : current.filter(x => x !== key);
        syncHiddenBadgesToBackend();
    }

    return (
        <div>
            <Forms.FormTitle tag="h3">{t("Hide Real Badges")}</Forms.FormTitle>
            <Forms.FormText className={cl("hint")}>
                {t("Hide any of your own real Discord badges from your profile - not the badges above, those are HyperCord's own. Synced, so this applies for everyone viewing your profile, not just you.")}
            </Forms.FormText>

            {badges === null ? (
                <Text variant="text-sm/normal">{t("Loading your badges...")}</Text>
            ) : badges.length === 0 ? (
                <Text variant="text-sm/normal" className={cl("hint")}>{t("You don't have any real Discord badges to hide.")}</Text>
            ) : (
                <div className={cl("grid")}>
                    {badges.map(badge => (
                        <Checkbox
                            key={badge.key}
                            value={!hidden.has(badge.key)}
                            onChange={(_, checked) => toggle(badge.key, !checked)}
                            size={18}
                        >
                            <span className={cl("badge-label")}>
                                <img src={badge.iconSrc} alt="" className={cl("badge-icon")} />
                                {badge.label}
                            </span>
                        </Checkbox>
                    ))}
                </div>
            )}
        </div>
    );
}
