import pathlib from "path";

import { type Node } from "@webtoon/psd";

export type LayerInfo = {
    posture: string;
    character: string;
    attribute: string;
    path: string;
};

export function isValidName(name: string) {
    return !!parseName(name);
}

export function parsePath(path: string): LayerInfo | null {
    const parsed = pathlib.parse(path);
    const info = parseName(parsed.name);
    if (!info) {
        return null;
    }

    return { ...info, path };
}

function parseName(name: string) {
    const [character, posture, attribute] = name
        .split("::")
        .map((s) => s.trim())
        .filter((s) => s);

    if (!character || !posture || !attribute) {
        console.error(
            "Expected group layer hierarchy to be: Character name -> Posture -> Attribute",
        );
    }

    return { character, posture, attribute };
}

export function parentNames(node: Node): string[] {
    const parent = node.parent;
    if (!parent || parent.type === "Psd") {
        return [];
    }

    return parentNames(parent).concat([parent.name]);
}
