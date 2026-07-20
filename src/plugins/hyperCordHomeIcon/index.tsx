/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

import style from "./style.css?managed";

export default definePlugin({
    name: "HyperCordHomeIcon",
    description: "Replaces the Home button in the server list with HyperCord's own icon",
    tags: ["Appearance"],
    authors: [Devs.HyperCordTeam],
    required: true,
    managedStyle: style
});
