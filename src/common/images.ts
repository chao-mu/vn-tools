import fs from "fs";
import pathlib from "path";

import Psd, { type Group, type Layer, type Node } from "@webtoon/psd";

import { PNG } from "pngjs";

import sharp from "sharp";

import { LayerInfo } from "./names";

export function traversePsd({
    parent,
    visitLayer,
    visitGroup,
    visitPsd,
}: {
    parent: Node;
    visitLayer?: (layer: Layer) => void;
    visitGroup?: (group: Group) => void;
    visitPsd?: (psd: Psd) => void;
}) {
    const layers: Record<string, LayerInfo> = {};
    const errors: Record<string, string> = {};
    function traverseNode(node: Node) {
        if (node.type === "Layer") {
            visitLayer?.(node);
        } else if (node.type === "Group") {
            visitGroup?.(node);
        } else if (node.type === "Psd") {
            visitPsd?.(node);
        }

        node.children?.forEach((child) => traverseNode(child));
    }

    traverseNode(parent);

    return { layers, errors };
}

export async function writeLayer(outPath: string, layer: Layer) {
    console.log(`Rendering ${layer.name} to ${outPath}`);

    const pixels = await layer.composite();
    const png = new PNG({
        width: layer.width,
        height: layer.height,
    });

    png.data = Buffer.from(pixels);
    png.pack().pipe(fs.createWriteStream(outPath));
}

function getLayersByCategory(layers: LayerInfo[]) {
    const layersByCategory: Record<string, LayerInfo[]> = {};
    for (const info of layers) {
        const { posture } = info;
        layersByCategory[posture] = (layersByCategory[posture] ?? []).concat(info);
    }

    return layersByCategory;
}

export function buildLayerTree(layers: LayerInfo[]) {
    layers.forEach((layer) => {
        const segments = [layer.character, layer.posture, layer.attribute];
    });
}

export function permutateLayers(layers: LayerInfo[]) {
    const layersByCategory = getLayersByCategory(layers);

    const combos: LayerInfo[][] = [];
    const f = (consumedCategories: string[], acc: LayerInfo[]) => {
        if (consumedCategories.length >= Object.keys(layersByCategory).length) {
            combos.push(acc);
            return;
        }

        for (const [posture, layers] of Object.entries(layersByCategory)) {
            if (consumedCategories.includes(posture)) {
                continue;
            }

            for (const layer of layers) {
                f([...consumedCategories, posture], acc.concat(layer));
            }

            return;
        }
    };

    f([], []);

    return combos;
}

export async function writeComposite(outDir: string, layers: LayerInfo[]) {
    const outPath =
        pathlib.join(outDir, layers.map((info) => info.attribute).join(" ")) + ".png";

    console.log(`Rendering ${outPath}`);

    const backgroundLayer = layers.shift();
    if (!backgroundLayer) {
        throw new Error("Expected stack of layers to at least have one layer");
    }

    await sharp(backgroundLayer.path)
        .composite(layers.map((layer) => ({ input: layer.path, blend: "multiply" })))
        .toFile(outPath);
}

export function parentNames(node: Node): string[] {
    const parent = node.parent;
    if (!parent || parent.type === "Psd") {
        return [];
    }

    return parentNames(parent).concat([parent.name]);
}
