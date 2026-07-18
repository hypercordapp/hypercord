/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

const DICTIONARY: Record<string, string> = {
    hello: "ahoy",
    hi: "ahoy",
    hey: "arrr",
    my: "me",
    mine: "me own",
    friend: "matey",
    friends: "mateys",
    you: "ye",
    your: "yer",
    yes: "aye",
    no: "nay",
    is: "be",
    are: "be",
    the: "th'",
    money: "booty",
    drink: "grog",
    stop: "avast",
    hello_there: "ahoy there",
    excellent: "shiver me timbers",
    old: "old salt",
    man: "matey",
    woman: "lassie",
    sailor: "sea dog",
    ship: "vessel",
    where: "whar",
};

export default definePlugin({
    name: "PirateSpeak",
    description: "Arrr! Translates yer outgoing messages into pirate speak",
    tags: ["Fun", "Chat"],
    authors: [Devs.HyperCordTeam],

    onBeforeMessageSend(_, msg: MessageObject) {
        if (!msg.content) return;

        msg.content = msg.content.replace(/[A-Za-z']+/g, word => {
            const lower = word.toLowerCase();
            const replacement = DICTIONARY[lower];
            if (!replacement) return word;

            if (word[0] === word[0].toUpperCase()) {
                return replacement[0].toUpperCase() + replacement.slice(1);
            }
            return replacement;
        });

        if (Math.random() < 0.2) msg.content += " arrr!";
    }
});
