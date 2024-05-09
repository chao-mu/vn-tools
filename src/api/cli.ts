import fs from "fs";
import pathlib from "path";

import Psd, { Layer } from "@webtoon/psd";

// Ours
import { buildHTMLIndex } from "../common/html";
import {
    permutateLayers,
    traversePsd,
    writeComposite,
    writeLayer,
} from "../common/images";
import { LayerInfo, isValidName, parentNames, parsePath } from "../common/names";

export async function composite(inPath: string, outDir: string) {
    const layers: LayerInfo[] = [];
    const paths = fs.readdirSync(inPath);
    for (let path of paths) {
        path = pathlib.join(inPath, path);

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

export function getLayerName(layer: Layer) {
    return [...parentNames(layer), layer.name].join(" :: ");
}

export async function writeIndex(inDir: string, outPath?: string) {
    const paths = fs.readdirSync(inDir);
    const layers = paths
        .map((path) => pathlib.join(".", path))
        .flatMap((path) => parsePath(path) ?? []);
    const html = buildHTMLIndex(layers);

    outPath ??= pathlib.join(inDir, "index.html");

    fs.writeFileSync(outPath, html);
}

export async function extract(path: string, outDir: string) {
    const psdData = fs.readFileSync(path);
    const psdFile = Psd.parse(psdData.buffer);
    const imagePaths: string[] = [];

    traversePsd({
        parent: psdFile,
        visitLayer: (layer) => {
            const name = getLayerName(layer);
            if (isValidName(name)) {
                const outPath = pathlib.join(outDir, `${name}.png`);
                imagePaths.push(outPath);
                writeLayer(outPath, layer).catch((err) =>
                    console.error("Failed to write layer.", name, err),
                );
            } else {
                console.warn("Invalid layer hierarchy, skipping.", name);
            }
        },
    });
}

export async function inspect(path: string) {
    const psdData = fs.readFileSync(path);
    const psdFile = Psd.parse(psdData.buffer);

    traversePsd({
        parent: psdFile,
        visitLayer: (layer) => {
            console.log(getLayerName(layer));
        },
    });
}
