/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SniperMode } from "../types";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const ALPHANUMERIC = LETTERS + DIGITS;

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Generates 3-Letter pure letter combinations (e.g. aaa, aab, ... zzz -> 17,576 names)
 */
export function generate3LLetters(): string[] {
    const list: string[] = [];
    for (let i = 0; i < LETTERS.length; i++) {
        for (let j = 0; j < LETTERS.length; j++) {
            for (let k = 0; k < LETTERS.length; k++) {
                list.push(LETTERS[i] + LETTERS[j] + LETTERS[k]);
            }
        }
    }
    return shuffleArray(list);
}

/**
 * Generates 3-Letter alphanumeric combinations (e.g. a1b, 7xz, 999 -> 46,656 names)
 */
export function generate3LAlphanumeric(): string[] {
    const list: string[] = [];
    for (let i = 0; i < ALPHANUMERIC.length; i++) {
        for (let j = 0; j < ALPHANUMERIC.length; j++) {
            for (let k = 0; k < ALPHANUMERIC.length; k++) {
                list.push(ALPHANUMERIC[i] + ALPHANUMERIC[j] + ALPHANUMERIC[k]);
            }
        }
    }
    return shuffleArray(list);
}

/**
 * Generates high-value 3-Letter repeating & clean aesthetic patterns (e.g. 777, aaa, aba, 101, etc.)
 */
export function generate3LRepeating(): string[] {
    const list = new Set<string>();

    // Triples (aaa, 111, etc.)
    for (const c of ALPHANUMERIC) {
        list.add(c + c + c);
    }

    // Palindromes / ABA pattern (aba, 7x7, 101, etc.)
    for (const a of ALPHANUMERIC) {
        for (const b of ALPHANUMERIC) {
            if (a !== b) list.add(a + b + a);
        }
    }

    // AAB & BAA patterns
    for (const a of ALPHANUMERIC) {
        for (const b of ALPHANUMERIC) {
            if (a !== b) {
                list.add(a + a + b);
                list.add(b + a + a);
            }
        }
    }

    return shuffleArray(Array.from(list));
}

/**
 * Generates 4-Letter pure letter combinations (e.g. aaaa ... zzzz)
 */
export function generate4LLetters(): string[] {
    const list: string[] = [];
    for (let i = 0; i < LETTERS.length; i++) {
        for (let j = 0; j < LETTERS.length; j++) {
            for (let k = 0; k < LETTERS.length; k++) {
                for (let l = 0; l < LETTERS.length; l++) {
                    list.push(LETTERS[i] + LETTERS[j] + LETTERS[k] + LETTERS[l]);
                }
            }
        }
    }
    return shuffleArray(list);
}

/**
 * Generates 4-Letter alphanumeric combinations (random sample batching)
 */
export function generate4LAlphanumeric(): string[] {
    const list: string[] = [];
    // To keep memory optimal for 4L alphanumeric (1.6M permutations), generate a randomized high-entropy set
    for (let i = 0; i < 50000; i++) {
        let name = "";
        for (let c = 0; c < 4; c++) {
            name += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
        }
        list.push(name);
    }
    return list;
}

/**
 * Generates clean aesthetic 4-Letter repeating patterns (e.g. aaaa, abab, aabb, abba, 7777, 1337)
 */
export function generate4LRepeating(): string[] {
    const list = new Set<string>();

    // Quadruples (aaaa, 7777)
    for (const c of ALPHANUMERIC) {
        list.add(c + c + c + c);
    }

    // ABAB pattern (abab, 1212)
    for (const a of ALPHANUMERIC) {
        for (const b of ALPHANUMERIC) {
            if (a !== b) list.add(a + b + a + b);
        }
    }

    // AABB pattern (aabb, 1122)
    for (const a of ALPHANUMERIC) {
        for (const b of ALPHANUMERIC) {
            if (a !== b) list.add(a + a + b + b);
        }
    }

    // ABBA pattern (abba, 1221)
    for (const a of ALPHANUMERIC) {
        for (const b of ALPHANUMERIC) {
            if (a !== b) list.add(a + b + b + a);
        }
    }

    // AAAB & BAAA patterns
    for (const a of ALPHANUMERIC) {
        for (const b of ALPHANUMERIC) {
            if (a !== b) {
                list.add(a + a + a + b);
                list.add(b + a + a + a);
            }
        }
    }

    return shuffleArray(Array.from(list));
}

/**
 * Parses user-provided custom wordlist
 */
export function parseCustomWordlist(raw: string): string[] {
    if (!raw) return [];
    return raw
        .split(/[\n,;]+/)
        .map(w => w.trim().toLowerCase())
        .filter(w => w.length >= 2 && w.length <= 32 && /^[a-z0-9_.]+$/.test(w));
}

/**
 * Get candidate list based on selected mode
 */
export function generateCandidatesForMode(mode: SniperMode, customWordlist: string): string[] {
    switch (mode) {
        case "3l_letters":
            return generate3LLetters();
        case "3l_alphanumeric":
            return generate3LAlphanumeric();
        case "3l_repeating":
            return generate3LRepeating();
        case "4l_letters":
            return generate4LLetters();
        case "4l_alphanumeric":
            return generate4LAlphanumeric();
        case "4l_repeating":
            return generate4LRepeating();
        case "custom_wordlist":
            return parseCustomWordlist(customWordlist);
        default:
            return generate4LLetters();
    }
}
