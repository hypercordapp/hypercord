/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type SniperTier = "free" | "supporter" | "vip";

export type SniperMode =
    | "3l_letters"
    | "3l_alphanumeric"
    | "3l_repeating"
    | "4l_letters"
    | "4l_alphanumeric"
    | "4l_repeating"
    | "custom_wordlist";

export type ClaimAction = "auto_claim" | "prompt_modal" | "notify_only";

export interface SniperLogEntry {
    id: string;
    timestamp: number;
    username: string;
    status: "available" | "taken" | "claimed" | "rate_limited" | "error" | "info";
    message?: string;
}

export interface SniperStats {
    totalChecked: number;
    availableFound: number;
    claimedCount: number;
    rateLimitsHit: number;
    checksPerMinute: number;
    isRunning: boolean;
    currentUsername: string;
    lastFoundUsername?: string;
    lastFoundTime?: number;
}

export interface AvailableCandidate {
    username: string;
    timestamp: number;
    claimed: boolean;
}

export interface SniperConfig {
    mode: SniperMode;
    claimAction: ClaimAction;
    delayMs: number;
    customWordlist: string;
    webhookUrl: string;
    soundAlerts: boolean;
    autoRestartOnCooldown: boolean;
    cooldownWaitSeconds: number;
    accountPassword?: string;
}
