/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./LanguageToggle.css";

import { Settings } from "@api/Settings";
import { classNameFactory } from "@utils/css";
import { Clickable, Tooltip } from "@webpack/common";

const cl = classNameFactory("vc-language-toggle-");

export function LanguageToggle() {
    return (
        <Tooltip text={Settings.language === "tr" ? "Switch to English" : "Türkçeye geç"}>
            {({ onMouseEnter, onMouseLeave }) => (
                <Clickable
                    className={cl("button")}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onClick={() => { Settings.language = Settings.language === "tr" ? "en" : "tr"; }}
                >
                    {Settings.language === "tr" ? "EN" : "TR"}
                </Clickable>
            )}
        </Tooltip>
    );
}
