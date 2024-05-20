import fs from "fs";

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

type LayerTreePath = {
    path: string;
};

type LayerTreeLayer = {
    layer: LayerInfo;
};

type LayerTreeNode = LayerTreePath | LayerTreeLayer[];
type LayerTreeLevelValue = LayerTreePath | LayerTreeLayer;
type LayerTreeLevelValues = LayerTreeLevelValue[];

interface LayerTree {
    [key: string]: (string | LayerTree)[] | string;
}

export function buildLayerTree(layers: LayerInfo[]): LayerTree {
    const level: Record<string, LayerTreeLevelValues> = {};
    for (const layer of layers) {
        const { segments, path } = layer;

        const name = layer.segments.shift();
        if (name === undefined) {
            console.error(
                "Internal error: Unexpected undefined when building layer tree",
            );

            return {};
        }

        level[name] ??= [] as [];
        level[name].push(segments.length === 0 ? { path } : { layer });
    }

    const recurse = (nodes: LayerTreeLevelValues): (LayerTree | string)[] | string => {
        const paths: string[] = [];
        const layers: LayerInfo[] = [];

        for (const node of nodes) {
            if ("path" in node) {
                paths.push(node.path);
            } else {
                layers.push(node.layer);
            }
        }

        if (layers.length == 0 && paths.length == 1) {
            return paths[0];
        }

        const subtree = buildLayerTree(layers);
        return Object.keys(subtree).length > 0 ? [...paths, subtree] : paths;
    };

    return Object.fromEntries(
        Object.entries(level).map(([name, nodes]) => [name, recurse(nodes)]),
    );
}

export async function writeComposite(paths: string[], dest: string) {
    const backgroundLayer = paths.shift();
    if (!backgroundLayer) {
        throw new Error("Expected stack of layers to at least have one layer");
    }

    await sharp(backgroundLayer)
        .composite(paths.map((path) => ({ input: path, blend: "over" })))
        .toFile(dest);
}

export function getLayerSegments(layer: Layer) {
    return [...parentNames(layer), layer.name];
}

function parentNames(node: Node): string[] {
    const parent = node.parent;
    if (!parent || parent.type === "Psd") {
        return [];
    }

    return parentNames(parent).concat([parent.name]);
}
