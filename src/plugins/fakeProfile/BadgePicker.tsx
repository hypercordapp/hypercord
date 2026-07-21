/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { Checkbox, Forms, Text } from "@webpack/common";

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

export function BadgePicker() {
    const selected = new Set(settings.store.selectedBadges);

    return (
        <div>
            <Forms.FormTitle tag="h3">Badges</Forms.FormTitle>
            <Forms.FormText className={cl("hint")}>
                Pick any badges to show on your profile. Synced to HyperCord's backend and shown to every HyperCord user viewing your profile.
            </Forms.FormText>

            {BADGE_CATALOG.map(category => (
                <div key={category.title} className={cl("category")}>
                    <Text variant="text-xs/semibold" className={cl("category-title")}>
                        {category.title}
                    </Text>
                    <div className={cl("grid")}>
                        {category.badges.map(badge => (
                            <Checkbox
                                key={badge.key}
                                value={selected.has(badge.key)}
                                onChange={(_, checked) => toggle(category, badge.key, checked)}
                                size={18}
                            >
                                <span className={cl("badge-label")}>
                                    <img src={badge.iconSrc} alt="" className={cl("badge-icon")} />
                                    {badge.label}
                                </span>
                            </Checkbox>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
