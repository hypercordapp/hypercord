/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@i18n";
import { classNameFactory } from "@utils/css";
import type { ConnectedAccount } from "@vencord/discord-types";
import { Button, Checkbox, Forms, Select, Text, TextInput, useState } from "@webpack/common";

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

    function add() {
        const trimmed = name.trim();
        if (!trimmed) return;

        settings.store.fakeConnections = [...connections, { type: platform, name: trimmed, verified: true }];
        setName("");
    }

    function remove(index: number) {
        settings.store.fakeConnections = connections.filter((_, i) => i !== index);
    }

    function toggleVerified(index: number, verified: boolean) {
        settings.store.fakeConnections = connections.map((c, i) => i === index ? { ...c, verified } : c);
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
                <TextInput
                    value={name}
                    onChange={setName}
                    placeholder={t("Display name / username")}
                    className={cl("connection-add-input")}
                />
                <Button size={Button.Sizes.SMALL} onClick={add} disabled={!name.trim()}>
                    {t("Add")}
                </Button>
            </div>
        </div>
    );
}
