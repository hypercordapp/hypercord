/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { Button, Forms, IconUtils, RelationshipStore, Text, TextInput, useMemo, UserProfileStore, UserStore, useState } from "@webpack/common";

import { settings, syncAllCosmeticsFromUser } from ".";

const cl = classNameFactory("vc-fakeprofile-");

interface FriendEntry {
    id: string;
    name: string;
    avatar: string;
    hasDecoration: boolean;
    hasNameplate: boolean;
    hasProfileEffect: boolean;
    total: number;
}

function hasDecoration(userId: string) {
    return (UserStore.getUser(userId) as any)?.avatarDecorationData != null;
}

function hasNameplate(userId: string) {
    return (UserStore.getUser(userId) as any)?.collectibles?.nameplate != null;
}

function hasProfileEffect(userId: string) {
    return (UserProfileStore.getUserProfile(userId) as any)?.profileEffect != null;
}

// Only your friends are worth listing here - a random guild could have
// thousands of members most of whom you've never even loaded a User record
// for, so these checks would just be false-negative noise. Friends are
// always fully hydrated (you have a relationship with them), so this is all
// already-cached UserStore/UserProfileStore data, no extra network fetch.
function useFriends(refreshKey: number): FriendEntry[] {
    return useMemo(() => {
        const friends = RelationshipStore.getFriendIDs()
            .map(id => UserStore.getUser(id))
            .filter((user): user is NonNullable<typeof user> => user != null)
            .map(user => {
                const decoration = hasDecoration(user.id);
                const nameplate = hasNameplate(user.id);
                const profileEffect = hasProfileEffect(user.id);
                return {
                    id: user.id,
                    name: user.globalName || user.username,
                    avatar: IconUtils.getUserAvatarURL(user, false, 64),
                    hasDecoration: decoration,
                    hasNameplate: nameplate,
                    hasProfileEffect: profileEffect,
                    total: Number(decoration) + Number(nameplate) + Number(profileEffect)
                };
            });

        // Friends with the most of the three cosmetics equipped float to the
        // top - most interesting picks first instead of alphabetical noise.
        return friends.sort((a, b) => {
            if (a.total !== b.total) return b.total - a.total;
            return a.name.localeCompare(b.name);
        });
    }, [refreshKey]);
}

export function CosmeticsPicker() {
    const [query, setQuery] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const selected = settings.use(["fakeCosmeticsFromUserId"]).fakeCosmeticsFromUserId;
    const friends = useFriends(refreshKey);

    const trimmedQuery = query.trim().toLowerCase();
    const filtered = trimmedQuery
        ? friends.filter(f => f.name.toLowerCase().includes(trimmedQuery))
        : friends;

    function pick(id: string) {
        settings.store.fakeCosmeticsFromUserId = id === selected ? "" : id;
        syncAllCosmeticsFromUser();
    }

    return (
        <div className={cl("category")}>
            <Forms.FormTitle tag="h3">Copy Cosmetics From a Friend</Forms.FormTitle>
            <Forms.FormText className={cl("hint")}>
                Pick one friend and copy whichever of their real avatar decoration,
                nameplate and profile effect they actually have equipped, all at once.
                Synced to HyperCord's backend. Avatar decoration shows for every
                HyperCord user viewing you; nameplate/profile effect rendering for
                other viewers is still experimental.
            </Forms.FormText>

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
                        {friend.hasDecoration && <span className={cl("friend-has-tag")}>decoration</span>}
                        {friend.hasNameplate && <span className={cl("friend-has-tag")}>nameplate</span>}
                        {friend.hasProfileEffect && <span className={cl("friend-has-tag")}>effect</span>}
                        {friend.id === selected && <span className={cl("friend-selected-tag")}>selected</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}
