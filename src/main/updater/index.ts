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

// HyperCord always ships injected into the real Discord client, copied into
// %APPDATA%\HyperCord\dist - that directory is never a live git checkout (see
// the client-side deploy workflow), so the git-based updater's `git remote
// get-url origin` / `git fetch` calls always failed there ("Failed to
// retrieve repo" / "Failed to check for updates" in the console, every
// session). The HTTP updater needs no local git at all - it compares against
// hypercordapp/hypercord's "DevBuild <hash>" GitHub release (already
// published on every push) and downloads patcher.js/preload.js/renderer.js/
// renderer.css straight from its assets, which is also exactly what the
// manual scp+cp deploy step does by hand. Always use it, regardless of
// IS_STANDALONE (that flag is about Vesktop-style standalone builds, a
// different axis - HyperCord is never a git-checkout install either way).
if (!IS_UPDATER_DISABLED)
    require("./http");
