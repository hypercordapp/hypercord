/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 HyperCord Team and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { classNameFactory } from "@utils/css";
import { Button, ColorPicker, Forms, Text } from "@webpack/common";

import { settings } from ".";

const cl = classNameFactory("vc-fakeprofile-");

function parseHex(hex: string): number | undefined {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    return match ? parseInt(match[1], 16) : undefined;
}

function toHex(color: number): string {
    return "#" + color.toString(16).padStart(6, "0");
}

function Swatch({ label, settingKey }: { label: string; settingKey: "fakeAccentColor" | "fakeThemeColorPrimary" | "fakeThemeColorSecondary"; }) {
    const hex = settings.store[settingKey];
    const color = hex ? parseHex(hex) : undefined;

    return (
        <div className={cl("color-swatch")}>
            <ColorPicker
                color={color ?? 0x5865f2}
                label={<Text variant="text-xs/normal">{label}</Text>}
                onChange={(newColor: number) => { settings.store[settingKey] = toHex(newColor); }}
            />
            {hex && (
                <Button
                    size={Button.Sizes.SMALL}
                    look={Button.Looks.LINK}
                    color={Button.Colors.PRIMARY}
                    onClick={() => { settings.store[settingKey] = ""; }}
                >
                    Reset
                </Button>
            )}
        </div>
    );
}

export function ProfileColorPickers() {
    return (
        <div>
            <Forms.FormTitle tag="h3">Profile Colors</Forms.FormTitle>
            <Forms.FormText className={cl("hint")}>
                Pick colors instead of typing hex codes. Only visible to you, in your own HyperCord client - the primary/secondary theme colors need both set to apply.
            </Forms.FormText>
            <Flex gap="1.5em" className={cl("color-row")}>
                <Swatch label="Accent Color" settingKey="fakeAccentColor" />
                <Swatch label="Theme Primary" settingKey="fakeThemeColorPrimary" />
                <Swatch label="Theme Secondary" settingKey="fakeThemeColorSecondary" />
            </Flex>
        </div>
    );
}
