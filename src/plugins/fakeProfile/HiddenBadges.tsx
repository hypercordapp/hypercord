/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@i18n";
import BadgeAPIPlugin from "@plugins/_api/badges";
import { classNameFactory } from "@utils/css";
import { fetchUserProfile } from "@utils/discord";
import { Checkbox, Forms, Text, useEffect, UserStore, useState } from "@webpack/common";

import { settings, syncHiddenBadgesToBackend } from ".";

const cl = classNameFactory("vc-fakeprofile-");

interface HideableBadge {
    key: string;
    label: string;
    iconSrc: string;
}

// Two different sources, shown together as one list since from the user's
// point of view they're the same thing ("badges on my profile that aren't
// FakeProfile's own picks"):
// - Real, Discord-issued badges (Quest Completed, seasonal event badges,
//   HypeSquad, Bug Hunter, etc.) - fetched fresh from the user's own real
//   profile, keyed by Discord's own stable badge type id.
// - Admin-added custom badges (a personally-labeled donor badge etc.) -
//   these already live in HyperCord's own backend, keyed by image URL (see
//   BadgeAPIPlugin.getHideableAdminBadges' own comment on why not an id).
export function HiddenBadgesPicker() {
    const [badges, setBadges] = useState<HideableBadge[] | null>(null);

    useEffect(() => {
        (async () => {
            const myId = UserStore.getCurrentUser()?.id;
            if (!myId) return;

            const profile = await fetchUserProfile(myId);
            const realBadges: HideableBadge[] = ((profile as any)?.badges ?? []).map((b: any) => ({
                key: b.id,
                label: b.description,
                iconSrc: `https://cdn.discordapp.com/badge-icons/${b.icon}.png`
            }));

            const adminBadges: HideableBadge[] = BadgeAPIPlugin.getHideableAdminBadges(myId).map(b => ({
                key: b.badge,
                label: b.tooltip,
                iconSrc: b.badge
            }));

            setBadges([...realBadges, ...adminBadges]);
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
