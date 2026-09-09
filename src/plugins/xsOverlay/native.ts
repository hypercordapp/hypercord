/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createSocket, Socket } from "dgram";

let xsoSocket: Socket;

export function sendToOverlay(_, data: any) {
    data.messageType = data.type;
    const json = JSON.stringify(data);
    if (!xsoSocket) {
        xsoSocket = createSocket("udp4");
        xsoSocket.on("error", err => {
            console.error("[xsOverlay] UDP socket error:", err);
        });
    }
    xsoSocket.send(json, 42069, "127.0.0.1");
}
