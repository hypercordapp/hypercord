/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { Button, Forms, IconUtils, RelationshipStore, Text, TextInput, useMemo, UserProfileStore, UserStore, useState } from "@webpack/common";

import { settings, syncAvatarDecorationToBackend, syncNameplateToBackend, syncProfileEffectToBackend } from ".";

const cl = classNameFactory("vc-fakeprofile-");

interface FriendEntry {
    id: string;
    name: string;
    avatar: string;
    has: boolean;
}

// Only your friends are worth listing here - a random guild could have
// thousands of members most of whom you've never even loaded a User record
// for, so "has" would just be false-negative noise. Friends are always fully
// hydrated (you have a relationship with them), so checking `has` off
// already-cached UserStore/UserProfileStore data is instant, no extra
// network fetch needed.
function useFriends(hasField: (userId: string) => boolean, refreshKey: number): FriendEntry[] {
    return useMemo(() => {
        const friends = RelationshipStore.getFriendIDs()
            .map(id => UserStore.getUser(id))
            .filter((user): user is NonNullable<typeof user> => user != null)
            .map(user => ({
                id: user.id,
                name: user.globalName || user.username,
                avatar: IconUtils.getUserAvatarURL(user, false, 64),
                has: hasField(user.id)
            }));

        // Friends who actually have this cosmetic equipped float to the top -
        // picking one who doesn't have it just copies nothing.
        return friends.sort((a, b) => {
            if (a.has !== b.has) return a.has ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    }, [refreshKey]);
}

interface CosmeticPickerProps {
    settingsKey: "fakeAvatarDecorationFromUserId" | "fakeNameplateFromUserId" | "fakeProfileEffectFromUserId";
    title: string;
    hint: string;
    sync: (silent?: boolean) => unknown;
    hasField: (userId: string) => boolean;
}

export function CosmeticPicker({ settingsKey, title, hint, sync, hasField }: CosmeticPickerProps) {
    const [query, setQuery] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const selected = settings.use([settingsKey])[settingsKey];
    const friends = useFriends(hasField, refreshKey);

    const trimmedQuery = query.trim().toLowerCase();
    const filtered = trimmedQuery
        ? friends.filter(f => f.name.toLowerCase().includes(trimmedQuery))
        : friends;

    function pick(id: string) {
        settings.store[settingsKey] = id === selected ? "" : id;
        sync();
    }

    return (
        <div className={cl("category")}>
            <Forms.FormTitle tag="h3">{title}</Forms.FormTitle>
            <Forms.FormText className={cl("hint")}>{hint}</Forms.FormText>

            <div className={cl("picker-toolbar")}>
                <TextInput
                    value={query}
                    onInput={e => setQuery((e.target as HTMLInputElement).value)}
                    placeholder="Search friends..."
                    className={cl("picker-search")}
                />
                <Button
                    size={Button.Sizes.SMALL}
                    look={Button.Looks.FILLED}
                    onClick={() => setRefreshKey(k => k + 1)}
                >
                    Refresh
                </Button>
            </div>

            <div className={cl("friend-list")}>
                {filtered.length === 0 && (
                    <Text variant="text-sm/normal" className={cl("hint")}>
                        No friends match that search.
                    </Text>
                )}
                {filtered.map(friend => (
                    <div
                        key={friend.id}
                        className={cl("friend-row") + (friend.id === selected ? " " + cl("friend-row-selected") : "")}
                        onClick={() => pick(friend.id)}
                    >
                        <img src={friend.avatar} alt="" className={cl("friend-avatar")} />
                        <span className={cl("friend-name")}>{friend.name}</span>
                        {friend.has && <span className={cl("friend-has-tag")}>equipped</span>}
                        {friend.id === selected && <span className={cl("friend-selected-tag")}>selected</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function AvatarDecorationPicker() {
    return (
        <CosmeticPicker
            settingsKey="fakeAvatarDecorationFromUserId"
            title="Avatar Decoration"
            hint="Pick a friend with a real avatar decoration equipped - copies it onto your own profile, synced to HyperCord's backend and shown to every HyperCord user viewing you. Friends who currently have one are sorted to the top and marked 'equipped'."
            sync={syncAvatarDecorationToBackend}
            hasField={userId => (UserStore.getUser(userId) as any)?.avatarDecorationData != null}
        />
    );
}

export function NameplatePicker() {
    return (
        <CosmeticPicker
            settingsKey="fakeNameplateFromUserId"
            title="Nameplate"
            hint="Pick a friend with a real nameplate equipped. Stored on HyperCord's backend, but rendering it on other viewers' clients is still a work in progress."
            sync={syncNameplateToBackend}
            hasField={userId => (UserStore.getUser(userId) as any)?.collectibles?.nameplate != null}
        />
    );
}

export function ProfileEffectPicker() {
    return (
        <CosmeticPicker
            settingsKey="fakeProfileEffectFromUserId"
            title="Profile Effect"
            hint="Pick a friend with a real profile effect equipped. Stored on HyperCord's backend, but rendering it on other viewers' clients is still a work in progress."
            sync={syncProfileEffectToBackend}
            hasField={userId => (UserProfileStore.getUserProfile(userId) as any)?.profileEffect != null}
        />
    );
}
