/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";

import { tr } from "./tr";

export type Language = "en" | "tr";

/**
 * Translates a plugin-authored UI string (description, setting label, select option, placeholder, ...)
 * into the currently selected language. Falls back to the original English string whenever the
 * current language is English, or no translation for that exact string exists yet - so an untranslated
 * plugin never breaks, it just stays in English.
 */
export function t<T extends string | undefined | null>(text: T): T {
    if (!text) return text;
    if (Settings.language !== "tr") return text;

    const translated = tr[text];
    return (translated ?? text) as T;
}

export function toggleLanguage() {
    Settings.language = Settings.language === "tr" ? "en" : "tr";
}
