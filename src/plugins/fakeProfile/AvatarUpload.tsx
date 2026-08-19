/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { t } from "@i18n";
import BadgeAPIPlugin from "@plugins/_api/badges";
import { classNameFactory } from "@utils/css";
import { Button, Forms, Toasts, useState } from "@webpack/common";

import { settings, syncAvatarToBackend } from ".";
import { getBadgeAuthHeader } from "./badgeAuth";

const cl = classNameFactory("vc-fakeprofile-");
const SELF_PROFILES_BASE = "https://api.hypercord.pro/self/profiles";

async function uploadAvatarFile(file: File, userId: string) {
    const auth = await getBadgeAuthHeader();
    if (!auth) {
        Toasts.show({
            id: Toasts.genId(),
            message: t("Couldn't verify your Discord identity - a HyperCord authorization popup should have appeared, complete it and try again."),
            type: Toasts.Type.FAILURE
        });
        return;
    }

    const res = await fetch(`${SELF_PROFILES_BASE}/${userId}/avatar/upload`, {
        method: "POST",
        headers: { "Content-Type": file.type, Authorization: auth },
        body: file
    });

    if (res.status === 409) {
        Toasts.show({ id: Toasts.genId(), message: t("Can't set your avatar - HyperCord staff already set one for you."), type: Toasts.Type.FAILURE });
        return;
    }
    if (!res.ok) {
        Toasts.show({
            id: Toasts.genId(),
            message: Settings.language === "tr" ? `Görsel yüklenemedi (hata ${res.status}).` : `Couldn't upload that image (error ${res.status}).`,
            type: Toasts.Type.FAILURE
        });
        return;
    }

    const result = await res.json();
    settings.store.fakeAvatarUrl = result.avatar ?? "";
    await BadgeAPIPlugin.refetchBadges();
    Toasts.show({ id: Toasts.genId(), message: t("Avatar updated!"), type: Toasts.Type.SUCCESS });
}

export function AvatarUploadButton({ getCurrentUserId }: { getCurrentUserId: () => string | undefined; }) {
    const [uploading, setUploading] = useState(false);
    const hasFake = Boolean(settings.use(["fakeAvatarUrl"]).fakeAvatarUrl);

    return (
        <div>
            <Forms.FormTitle tag="h3">Profile Picture</Forms.FormTitle>
            <Forms.FormText className={cl("hint")}>
                Pick an image from your device to use as a fake avatar - synced to HyperCord's backend and shown to every HyperCord user viewing your profile. Your real Discord avatar is untouched.
            </Forms.FormText>
            <div className={cl("avatar-upload-row")}>
                <input
                    id="vc-fakeprofile-avatar-input"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    style={{ display: "none" }}
                    onChange={async e => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;

                        const userId = getCurrentUserId();
                        if (!userId) return;

                        setUploading(true);
                        try {
                            await uploadAvatarFile(file, userId);
                        } catch (err) {
                            Toasts.show({ id: Toasts.genId(), message: t("Failed to upload avatar."), type: Toasts.Type.FAILURE });
                        } finally {
                            setUploading(false);
                        }
                    }}
                />
                <Button
                    size={Button.Sizes.SMALL}
                    disabled={uploading}
                    onClick={() => document.getElementById("vc-fakeprofile-avatar-input")?.click()}
                >
                    {uploading ? t("Uploading...") : t("Choose from device")}
                </Button>
                {hasFake && (
                    <Button
                        size={Button.Sizes.SMALL}
                        look={Button.Looks.LINK}
                        color={Button.Colors.RED}
                        onClick={() => {
                            settings.store.fakeAvatarUrl = "";
                            syncAvatarToBackend();
                        }}
                    >
                        {t("Remove fake avatar")}
                    </Button>
                )}
            </div>
        </div>
    );
}
