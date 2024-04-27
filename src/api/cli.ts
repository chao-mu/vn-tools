import Psd from "@webtoon/psd";
import fs from "fs";
import pathlib from "path";
import {
    LayerInfo,
    isValidName,
    parsePath,
    permutateLayers,
    traversePsd,
    writeComposite,
    writeLayer,
} from "../shared";

export async function composite(inPath: string, outDir: string) {
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

export async function extract(path: string, outdir: string) {
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

export async function inspect(path: string) {
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
