/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@i18n";
import { classNameFactory } from "@utils/css";
import { Button, Checkbox, Forms, Text, Toasts } from "@webpack/common";

import { settings, syncBadgesToBackend } from ".";
import { BADGE_CATALOG, CatalogCategory } from "./badgeCatalog";

const cl = classNameFactory("vc-fakeprofile-");

function toggle(category: CatalogCategory, key: string, checked: boolean) {
    const current = settings.store.selectedBadges;

    if (!checked) {
        settings.store.selectedBadges = current.filter(k => k !== key);
    } else if (category.exclusive) {
        // Real Discord only ever shows one badge from these categories at a time
        // (one Nitro tier, one boost-months tile, one HypeSquad house) - picking
        // a new one here should replace whichever other one from the same
        // category was selected, not just add another checkbox on top of it.
        const categoryKeys = new Set(category.badges.map(b => b.key));
        settings.store.selectedBadges = [...current.filter(k => !categoryKeys.has(k)), key];
    } else {
        settings.store.selectedBadges = [...current, key];
    }

    syncBadgesToBackend();
}

// Most-requested single feature per user feedback - one click to clear every
// picked badge and resync, instead of unchecking each one (Nitro/Boost/Gift
// Giving/HypeSquad categories especially only ever have one checked at a
// time, but there's no single toggle that clears all categories at once).
function clearAll() {
    settings.store.selectedBadges = [];
    syncBadgesToBackend();
    Toasts.show({
        id: Toasts.genId(),
        message: t("All badges removed"),
        type: Toasts.Type.SUCCESS
    });
}

export function BadgePicker() {
    const selected = new Set(settings.store.selectedBadges);

    return (
        <div>
            <div className={cl("badges-header")}>
                <Forms.FormTitle tag="h3">Badges</Forms.FormTitle>
                {selected.size > 0 && (
                    <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} color={Button.Colors.RED} onClick={clearAll}>
                        {t("Remove All")}
                    </Button>
                )}
            </div>
            <Forms.FormText className={cl("hint")}>
                Pick any badges to show on your profile. Synced to HyperCord's backend and shown to every HyperCord user viewing your profile.
            </Forms.FormText>

            {BADGE_CATALOG.map(category => {
                // A hidden badge (no longer matches anything real, see
                // CatalogBadge.hidden) is only worth showing here at all for
                // someone who already has it picked - otherwise it'd be
                // offering something nobody should newly pick, or an empty
                // category (e.g. Quest) with nothing visible in it.
                const visibleBadges = category.badges.filter(b => !b.hidden || selected.has(b.key));
                if (!visibleBadges.length) return null;

                return (
                    <div key={category.title} className={cl("category")}>
                        <Text variant="text-xs/semibold" className={cl("category-title")}>
                            {category.title}
                        </Text>
                        <div className={cl("grid")}>
                            {visibleBadges.map(badge => (
                                <Checkbox
                                    key={badge.key}
                                    value={selected.has(badge.key)}
                                    onChange={(_, checked) => toggle(category, badge.key, checked)}
                                    size={18}
                                >
                                    <span className={cl("badge-label")}>
                                        <img src={badge.iconSrc} alt="" className={cl("badge-icon")} />
                                        {t(badge.label)}
                                    </span>
                                </Checkbox>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
