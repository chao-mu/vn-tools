import Psd, { type Group, type Layer, type Node } from "@webtoon/psd";
import fs from "fs";
import pathlib from "path";
import { PNG } from "pngjs";
import sharp from "sharp";

type LayerInfo = {
    category: string;
    attribute: string;
    name: string;
    path: string;
};

function isValidName(name: string) {
    return !!parseName(name);
}

function parsePath(path: string): LayerInfo | null {
    const parsed = pathlib.parse(path);
    const info = parseName(parsed.name);
    if (!info) {
        return null;
    }

    return { ...info, path };
}

function parseName(name: string) {
    const [, category, attribute] = /^(.*?)\s+-\s+(.*)$/.exec(name) ?? [];

    if (!category || !attribute) {
        return null;
    }

    return { category, attribute, name };
}

function traversePsd({
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
        if (node.type === "Layer" && visitLayer) {
            visitLayer(node);
        } else if (node.type === "Group" && visitGroup) {
            visitGroup(node);
        } else if (node.type === "Psd" && visitPsd) {
            visitPsd(node);
        } else {
            console.error(`Unsupported node type: `, node.type);
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

async function writeLayer(outPath: string, layer: Layer) {
    console.log(`Rendering ${layer.name} to ${outPath}`);

    const pixels = await layer.composite();
    const png = new PNG({
        width: layer.width,
        height: layer.height,
    });

    png.data = Buffer.from(pixels);
    png.pack().pipe(fs.createWriteStream(outPath));
}

export async function extractLayers(path: string, outdir: string) {
    const psdData = fs.readFileSync(path);
    const psdFile = Psd.parse(psdData.buffer);

    traversePsd({
        parent: psdFile,
        visitLayer: (layer) => {
            const { name } = layer;
            if (isValidName(name)) {
                const outPath = pathlib.join(outdir, `${name}.png`);
                writeLayer(outPath, layer).catch((err) =>
                    console.error("Failed to write layer.", name, err),
                );
            } else {
                console.warn("Invalid name, skipping.", name);
            }
        },
    });
}

export async function inspectPsd(path: string) {
    const psdData = fs.readFileSync(path);
    const psdFile = Psd.parse(psdData.buffer);

    traversePsd({
        parent: psdFile,
        visitLayer: (layer) => {
            const { name } = layer;
            console.log(name);
        },
    });
}

function permutateLayers(layers: LayerInfo[]) {
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

export async function compositePermutations(inPath: string, outDir: string) {
    const layers: LayerInfo[] = [];
    const paths = fs.readdirSync(inPath);
    for (const path of paths) {
        const layer = parsePath(path);
        if (layer !== null) {
            layers.push(layer);
        } else {
            console.error(`Failed to parse path: ${path}`);
            return;
        }
    }

    const combos = permutateLayers(layers);
    for (const combo of combos) {
        await writeComposite(outDir, combo);
    }
}

async function writeComposite(outDir: string, layers: LayerInfo[]) {
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
