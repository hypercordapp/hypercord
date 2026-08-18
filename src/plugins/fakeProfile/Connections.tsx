/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@i18n";
import { classNameFactory } from "@utils/css";
import type { ConnectedAccount } from "@vencord/discord-types";
import { Button, Checkbox, Forms, Select, Text, TextInput, useRef, useState } from "@webpack/common";

import { settings } from ".";

const cl = classNameFactory("vc-fakeprofile-");

type PlatformType = ConnectedAccount["type"];

// Discord's own real ConnectedAccount["type"] union (packages/discord-types),
// minus a handful that aren't user-selectable on real Discord either
// (skype/samsung/contacts/twitter_legacy/playstation-stg/amazon-music are
// internal/legacy variants, never offered in Discord's own "Add Connection"
// menu) - same real platform list real Discord lets you connect, so
// whatever's picked here renders with Discord's own real icon for that type.
const PLATFORMS: { value: PlatformType; label: string; }[] = [
    { value: "twitter", label: "X (Twitter)" },
    { value: "instagram", label: "Instagram" },
    { value: "youtube", label: "YouTube" },
    { value: "twitch", label: "Twitch" },
    { value: "tiktok", label: "TikTok" },
    { value: "github", label: "GitHub" },
    { value: "reddit", label: "Reddit" },
    { value: "spotify", label: "Spotify" },
    { value: "soundcloud", label: "SoundCloud" },
    { value: "steam", label: "Steam" },
    { value: "xbox", label: "Xbox" },
    { value: "playstation", label: "PlayStation Network" },
    { value: "battlenet", label: "Battle.net" },
    { value: "epicgames", label: "Epic Games" },
    { value: "riotgames", label: "Riot Games" },
    { value: "leagueoflegends", label: "League of Legends" },
    { value: "roblox", label: "Roblox" },
    { value: "facebook", label: "Facebook" },
    { value: "bluesky", label: "Bluesky" },
    { value: "mastodon", label: "Mastodon" },
    { value: "bungie", label: "Bungie.net" },
    { value: "crunchyroll", label: "Crunchyroll" },
    { value: "paypal", label: "PayPal" },
    { value: "ebay", label: "eBay" },
    { value: "domain", label: "Website" },
];

export interface FakeConnection {
    type: PlatformType;
    name: string;
    verified: boolean;
}

export function ConnectionsPicker() {
    const [platform, setPlatform] = useState<PlatformType>(PLATFORMS[0].value);
    const [name, setName] = useState("");

    const connections = settings.store.fakeConnections;

    // settings.store's entries are values read off Vencord's own reactive
    // settings Proxy, not plain objects - spreading/filtering/mapping them
    // straight back into a new array carries those Proxy wrappers along for
    // the ride. Assigning that back to settings.store then throws ("An
    // object could not be cloned") deep in the settings change-notify path,
    // which persists to disk via structured clone - live-confirmed the
    // write to the underlying array happens BEFORE that throw, so the
    // exception doesn't roll anything back, it just kills the rest of that
    // notify pass (including whatever listener re-renders this component).
    // Net effect live-reproduced: the picker's own list silently stops
    // updating after the first entry, while the real profile (read via a
    // completely different path, getUserProfile) picks up the partially-
    // applied write - a duplicate every time this ever half-succeeds.
    // Rebuilding a plain object per entry avoids feeding any of that back
    // into settings.store in the first place.
    const toPlain = (c: FakeConnection): FakeConnection => ({ type: c.type, name: c.name, verified: c.verified });

    // Guards against adding more than one entry per click - name/platform
    // are read fresh at call time, but two clicks landing close enough
    // together (a real double-click, or a focused button re-firing on a
    // held Enter key's repeat) could both run before React's re-render
    // clears the input/disables the button, each one appending its own
    // entry. This lock makes that impossible regardless of what causes the
    // extra invocation - only the first call in a burst ever does anything.
    const addingRef = useRef(false);

    function add() {
        if (addingRef.current) return;

        const trimmed = name.trim();
        if (!trimmed) return;

        addingRef.current = true;
        settings.store.fakeConnections = [...connections.map(toPlain), { type: platform, name: trimmed, verified: true }];
        setName("");
        setTimeout(() => { addingRef.current = false; }, 0);
    }

    function remove(index: number) {
        settings.store.fakeConnections = connections.filter((_, i) => i !== index).map(toPlain);
    }

    function toggleVerified(index: number, verified: boolean) {
        settings.store.fakeConnections = connections.map((c, i) => i === index ? { ...toPlain(c), verified } : toPlain(c));
    }

    return (
        <div>
            <Forms.FormTitle tag="h3">{t("Connections")}</Forms.FormTitle>
            <Forms.FormText className={cl("hint")}>
                {t("Add fake social media/game connections to show on your own profile - only visible to you, in your own HyperCord client, same as username/accent color above.")}
            </Forms.FormText>

            {connections.length > 0 && (
                <div className={cl("connections-list")}>
                    {connections.map((c, i) => (
                        <div key={i} className={cl("connection-row")}>
                            <Text variant="text-sm/normal" className={cl("connection-platform")}>
                                {PLATFORMS.find(p => p.value === c.type)?.label ?? c.type}
                            </Text>
                            <Text variant="text-sm/normal" className={cl("connection-name")}>
                                {c.name}
                            </Text>
                            <Checkbox
                                value={c.verified}
                                onChange={(_, checked) => toggleVerified(i, checked)}
                                size={16}
                            >
                                <Text variant="text-xs/normal">{t("Verified")}</Text>
                            </Checkbox>
                            <Button
                                size={Button.Sizes.SMALL}
                                look={Button.Looks.LINK}
                                color={Button.Colors.RED}
                                onClick={() => remove(i)}
                            >
                                {t("Remove")}
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <div className={cl("connection-add-row")}>
                <Select
                    options={PLATFORMS}
                    isSelected={v => v === platform}
                    select={setPlatform}
                    serialize={v => v}
                    placeholder={t("Platform")}
                    className={cl("connection-add-select")}
                />
                <div className={cl("connection-add-input")}>
                    <TextInput
                        value={name}
                        onChange={setName}
                        onKeyDown={e => { if (e.key === "Enter") add(); }}
                        placeholder={t("Display name / username")}
                    />
                </div>
                <Button size={Button.Sizes.SMALL} onClick={add} disabled={!name.trim()}>
                    {t("Add")}
                </Button>
            </div>
        </div>
    );
}
