/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import DonateButton from "@components/settings/DonateButton";
import BadgeAPI from "@plugins/_api/badges";
import { Button } from "@webpack/common";

export const isDonor = (userId: string) => (BadgeAPI.getDonorBadges(userId)?.length ?? 0) > 0;

export function DonateButtonComponent() {
    return (
        <DonateButton
            look={Button.Looks.FILLED}
            color={Button.Colors.WHITE}
            style={{ marginTop: "1em" }}
        />
    );
}
