import Psd, { type Group, type Layer, type Node } from "@webtoon/psd";
import fs from "fs";
import htmlCreator from "html-creator";
import pathlib from "path";
import { PNG } from "pngjs";
import sharp from "sharp";

export type LayerInfo = {
    category: string;
    attribute: string;
    name: string;
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
    const [, category, attribute] = /^(.*?)\s+::\s+(.*)$/.exec(name) ?? [];

    if (!category || !attribute) {
        return null;
    }

    return { category, attribute, name };
}

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

function getLayersByCategory(layers: LayerInfo[]) {
    const layersByCategory: Record<string, LayerInfo[]> = {};
    for (const info of layers) {
        const { category } = info;
        layersByCategory[category] = (layersByCategory[category] ?? []).concat(info);
    }

    return layersByCategory;
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

export function permutateLayers(layers: LayerInfo[]) {
    const layersByCategory = getLayersByCategory(layers);

    const combos: LayerInfo[][] = [];
    const f = (consumedCategories: string[], acc: LayerInfo[]) => {
        if (consumedCategories.length >= Object.keys(layersByCategory).length) {
            combos.push(acc);
            return;
        }

        for (const [category, layers] of Object.entries(layersByCategory)) {
            if (consumedCategories.includes(category)) {
                continue;
            }

            for (const layer of layers) {
                f([...consumedCategories, category], acc.concat(layer));
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

export function buildHTMLIndex(layers: LayerInfo[]) {
    const LayerDetails = ({ name }: LayerInfo) => ({
        type: "span",
        //content: `Posture: ${category}. Attribute: ${attribute}`,
        content: name,
    });
    const Image = (path: string) => ({
        type: "img",
        attributes: { src: path, width: 100, height: 100 },
    });

    const html = new htmlCreator([
        {
            type: "head",
            content: [
                {
                    type: "title",
                    content: "Generated HTML",
                },
                {
                    type: "style",
                    content: `
                img {
                  max-width: 100%;
                  height: auto;
                }
        `,
                },
            ],
        },
        {
            type: "body",
            attributes: {
                style: "display: grid; grid-template-columns: repeat( auto-fit, minmax(250px, 1fr) ); gap: 1rem;",
            },
            content: layers.map((layer) => ({
                type: "div",
                attributes: {
                    style: "border: solid; align-items: center; display: flex; flex-direction: column; padding: 0.5rem;",
                },
                content: [LayerDetails(layer), Image(layer.path)],
            })),
        },
    ]);

    return html.renderHTML();
}
