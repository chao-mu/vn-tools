import fs from "fs";
import pathlib from "path";

import Psd from "@webtoon/psd";

// Ours
import { buildHTMLIndex } from "../common/html";
import {
    getLayerSegments,
    traversePsd,
    writeComposite,
    writeLayer,
} from "../common/images";
import { LayerInfo, buildName, hasOverlap, parsePath } from "../common/names";

export async function composite(layers: LayerInfo[], outPath: string) {
    writeComposite(layers, outPath);
}

export async function suggest(show: string, inPaths: string[]) {
    const layers = inPaths.flatMap((path) => parsePath(path) ?? []);
    const [showTag, ...showAttribs] = show.split(" ").map((s) => s.toLowerCase());

    const byStem: Record<string, LayerInfo[]> = {};
    for (const layer of layers) {
        if (layer.tag !== showTag) {
            continue;
        }

        // Need Get more specific if exists
        if (hasOverlap(layer, { tag: showTag, attribs: showAttribs })) {
            const stem = layer.stem;
            byStem[stem] ??= [];

            byStem[stem].push(layer);
        }
    }

    // Process conflicts
    let kept: LayerInfo[] = [];
    const conflicts = [];
    for (const [, siblings] of Object.entries(byStem)) {
        const candidates: LayerInfo[] = [];
        for (const candidate of siblings) {
            const withoutStem = candidate.attribs.slice(0, candidate.attribs.length - 1);
            if (
                hasOverlap(
                    { tag: showTag, attribs: showAttribs },
                    { ...candidate, attribs: withoutStem },
                )
            ) {
                candidates.push(candidate);
            }
        }

        if (candidates.length > 1) {
            conflicts.push(candidates);
        } else {
            kept.push(...candidates);
        }
    }

    if (conflicts.length > 0) {
        console.log("Conflicts detected!");
        for (const conflict of conflicts) {
            console.log("--");
            for (const layer of conflict) {
                console.log("  ", layer.path);
            }
        }

        return;
    }

    //console.log(kept.map(({ path }) => path));

    // Now eliminate non-stems
    kept = kept.filter(({ stem, isAll }) => showAttribs.includes(stem) || isAll);

    const paths = kept.map(({ path }) => path);
    console.log(paths.join("\n"));
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
