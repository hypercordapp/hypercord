/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { LocaleStore } from "@webpack/common";

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

/**
 * True if DISCORD's own UI language (not our separate TR/EN toggle above) is
 * Turkish - LocaleStore.locale is Discord's real locale string ("tr", "en-US",
 * "de", ...), set from Discord's own Language setting.
 */
export function isDiscordLocaleTurkish(): boolean {
    return LocaleStore.locale?.toLowerCase().startsWith("tr") ?? false;
}

/**
 * Same as t(), but follows DISCORD's own UI language instead of our separate
 * TR/EN toggle - for badge names/tooltips specifically, so a badge only
 * reads in Turkish for a viewer whose Discord itself is already in Turkish
 * (matches every other real Discord badge, which is localized the same way),
 * regardless of what that viewer has our own toggle set to.
 */
export function tBadge<T extends string | undefined | null>(text: T): T {
    if (!text) return text;
    if (!isDiscordLocaleTurkish()) return text;

    const translated = tr[text];
    return (translated ?? text) as T;
}
