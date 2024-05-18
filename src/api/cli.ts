import fs from "fs";
import pathlib from "path";

import Psd from "@webtoon/psd";

// Ours
import { buildHTMLIndex } from "../common/html";
import { getLayerSegments, traversePsd, writeLayer } from "../common/images";
import { buildName, parsePath } from "../common/names";

export async function composite(layerPaths: string[], outPath: string) {
    console.log(layerPaths);
    console.log(outPath);
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

    traversePsd({
        parent: psdFile,
        visitLayer: (layer) => {
            const segments = getLayerSegments(layer);
            const name = buildName(segments);
            const outPath = pathlib.join(outDir, `${name}.png`);

            writeLayer(outPath, layer).catch((err) =>
                console.error("Failed to write layer.", name, err),
            );
        },
    });
}

export async function inspect(path: string) {
    const psdData = fs.readFileSync(path);
    const psdFile = Psd.parse(psdData.buffer);

    traversePsd({
        parent: psdFile,
        visitLayer: (layer) => {
            const segments = getLayerSegments(layer);
            const name = buildName(segments);
            console.log(name);
        },
    });
}
