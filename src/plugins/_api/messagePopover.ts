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

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "MessagePopoverAPI",
    description: "API to add buttons to message popovers.",
    authors: [Devs.KingFish, Devs.Ven, Devs.Nuckyz],
    patches: [
        // Live-verified 2026-08-18 (module dump via CDP, not a guess): the old
        // match relied on a `X.Y` (dotted) button-component reference and a
        // ~40-char gap before "togglePopout:" - current Discord uses a plain
        // top-level identifier for the button component (not dotted), and the
        // reaction-picker block now sits between two toolbar buttons rather
        // than butted up against the exact anchors the old regex assumed, so
        // it silently stopped matching. Anchored instead to the immediately
        // preceding toolbar button (always present, always {label:...}) via a
        // non-consuming lookbehind for the button-component reference, then
        // matches the whole reaction-picker block up to its own trailing
        // "]}):null," - inserting our buttons array right before it, same as
        // before.
        {
            find: "#{intl::MESSAGE_UTILITIES_A11Y_LABEL}",
            replacement: {
                match: /(?<=\((\i),\{label:.{0,120}?\]\}\):null,)\i\?\(0,\i\.jsxs\)\(\i\.Fragment,\{children:\[.{0,150}?message:(\i)\}\),.{0,80}?\(0,\i\.jsx\)\(\i,\{togglePopout:.{0,120}?\]\}\):null,/,
                replace: (reactButton, ButtonComponent, message) =>
                    `Vencord.Api.MessagePopover._buildPopoverElements(${ButtonComponent},${message}),${reactButton}`
            }
        }
    ]
});
