/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { Checkbox, Forms, Text } from "@webpack/common";

import { settings, syncBadgesToBackend } from ".";
import { BADGE_CATALOG } from "./badgeCatalog";

const cl = classNameFactory("vc-fakeprofile-");

function toggle(key: string, checked: boolean) {
    const current = settings.store.selectedBadges;
    settings.store.selectedBadges = checked
        ? [...current, key]
        : current.filter(k => k !== key);
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
                                onChange={(_, checked) => toggle(badge.key, checked)}
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
