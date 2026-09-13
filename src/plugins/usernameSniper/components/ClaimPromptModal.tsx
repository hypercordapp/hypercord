/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Modal, useState } from "@webpack/common";

import { AvailableCandidate } from "../types";

export function ClaimPromptModal({
    candidate,
    modalProps,
    onClose,
    onConfirmClaim,
}: {
    candidate: AvailableCandidate;
    modalProps?: any;
    onClose: () => void;
    onConfirmClaim: () => Promise<boolean>;
}) {
    const [claiming, setClaiming] = useState(false);
    const [claimed, setClaimed] = useState(false);

    const handleClaim = async () => {
        setClaiming(true);
        const success = await onConfirmClaim();
        setClaiming(false);
        if (success) {
            setClaimed(true);
            setTimeout(() => {
                onClose();
            }, 1800);
        }
    };

    return (
        <Modal
            {...modalProps}
            size="md"
        >
            <div className="hypercord-sniper-modal-root">
                <div style={{ fontSize: 48 }}>🎯</div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
                    BOŞTA KULLANICI ADI BULUNDU!
                </h2>

                <p style={{ color: "#aaa", margin: 0, fontSize: 14 }}>
                    Aranan kriterlere uygun nadir bir Discord kullanıcı adı tespit edildi:
                </p>

                <div className="hypercord-sniper-modal-target-box">
                    @{candidate.username}
                </div>

                {claimed ? (
                    <div style={{ color: "#00FF88", fontWeight: 800, fontSize: 18 }}>
                        🎉 KULLANICI ADI BAŞARIYLA HESABINIZA GEÇİRİLDİ!
                    </div>
                ) : (
                    <div style={{ display: "flex", gap: 12, width: "100%", marginTop: 8 }}>
                        <button
                            className="hypercord-sniper-btn start"
                            onClick={handleClaim}
                            disabled={claiming}
                            style={{ flex: 2, padding: "14px 24px", fontSize: 16 }}
                        >
                            {claiming ? "⚡ HESABA GEÇİRİLİYOR..." : "👑 HEMEN HESABIMA AL!"}
                        </button>
                        <button
                            className="hypercord-sniper-btn secondary"
                            onClick={onClose}
                            style={{ flex: 1 }}
                        >
                            Yoksay
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
}

