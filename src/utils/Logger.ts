/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// Captured once, at module load - before HyperCordTelemetry's plugin start()
// (which runs much later, after the whole app has initialized) ever gets a
// chance to monkey-patch the global console.error for crash reporting. Every
// Logger.error() call - official plugins and third-party userplugins alike,
// since they all share this one class - goes through this untouched
// reference instead of the live `console.error` global. This is deliberate:
// Logger.error() is routine, already-handled diagnostic logging (e.g. "API
// returned 500"), not the React-error-boundary blind spot the telemetry
// patch exists to catch (those boundaries print via console.error directly,
// never through Logger). Routing Logger through the real console keeps that
// fix intact while stopping every plugin's own error logs - including
// third-party userplugins the telemetry plugin explicitly promises never to
// report - from being silently swept into crash telemetry.
const nativeConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    debug: console.debug.bind(console),
};

export class Logger {
    /**
     * Returns the console format args for a title with the specified background colour and black text
     * @param color Background colour
     * @param title Text
     * @returns Array. Destructure this into {@link Logger}.errorCustomFmt or console.log
     *
     * @example logger.errorCustomFmt(...Logger.makeTitleElements("white", "Hello"), "World");
     */
    static makeTitle(color: string, title: string): [string, ...string[]] {
        return ["%c %c %s ", "", `background: ${color}; color: black; font-weight: bold; border-radius: 5px;`, title];
    }

    constructor(public name: string, public color: string = "white") { }

    private _log(level: "log" | "error" | "warn" | "info" | "debug", levelColor: string, args: any[], customFmt = "") {
        if (IS_REPORTER && IS_WEB && !IS_VESKTOP) {
            nativeConsole[level]("[HyperCord]", this.name + ":", ...args);
            return;
        }

        nativeConsole[level](
            `%c HyperCord %c %c ${this.name} ${customFmt}`,
            `background: ${levelColor}; color: black; font-weight: bold; border-radius: 5px;`,
            "",
            `background: ${this.color}; color: black; font-weight: bold; border-radius: 5px;`
            , ...args
        );
    }

    public log(...args: any[]) {
        this._log("log", "#a6d189", args);
    }

    public info(...args: any[]) {
        this._log("info", "#a6d189", args);
    }

    public error(...args: any[]) {
        this._log("error", "#e78284", args);
    }

    public errorCustomFmt(fmt: string, ...args: any[]) {
        this._log("error", "#e78284", args, fmt);
    }

    public warn(...args: any[]) {
        this._log("warn", "#e5c890", args);
    }

    public debug(...args: any[]) {
        this._log("debug", "#eebebe", args);
    }
}
