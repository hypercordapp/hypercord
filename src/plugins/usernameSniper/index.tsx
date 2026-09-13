/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import SettingsPlugin from "@plugins/_core/settings";
import { Devs } from "@utils/constants";
import { removeFromArray } from "@utils/misc";
import definePlugin from "@utils/types";
import { closeModal, openModal, SettingsRouter } from "@webpack/common";

import { ClaimPromptModal } from "./components/ClaimPromptModal";
import SniperPanel from "./components/SniperPanel";
import { sniperEngine } from "./sniperEngine";

function SniperIcon(props: any) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...props}>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
            <path d="M12 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 18V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 12H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M18 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

export default definePlugin({
    name: "HyperUsernameSniper",
    description: "Discord 3L & 4L nadir kullanıcı adı avcısı ve otomatik talep sistemi (Shopier Destekçi & VIP Özel).",
    tags: ["Utility", "Special"],
    authors: [Devs.HyperCordTeam],

    toolboxActions: {
        "Open Hyper Username Sniper": () => {
            SettingsRouter.openUserSettings("hypercord_username_sniper");
        },
    },

    start() {
        // Register custom settings tab
        SettingsPlugin.customEntries.push({
            key: "hypercord_username_sniper",
            title: "Hyper Username Sniper",
            Component: SniperPanel,
            Icon: SniperIcon,
        });

        // Register visual popup modal handler
        sniperEngine.setPromptModalHandler((candidate, onConfirm) => {
            const modalKey = openModal(props => (
                <ClaimPromptModal
                    candidate={candidate}
                    modalProps={props}
                    onClose={() => closeModal(modalKey)}
                    onConfirmClaim={onConfirm}
                />
            ));
        });
    },

    stop() {
        sniperEngine.stop();
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "hypercord_username_sniper");
    },
});


