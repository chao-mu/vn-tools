// Node
import fs from "fs";
import pathlib from "path";

// Photoshop
import Psd from "@webtoon/psd";

// React

// Ours
import { render } from "../common/web";

import { LayerGallery } from "../client/LayerGallery";
import {
    getLayerSegments,
    traversePsd,
    writeComposite,
    writeLayer,
} from "../common/images";
import { LayerInfo, buildName, diffLayers, hasOverlap, parsePath } from "../common/names";

export async function composite(layerPaths: string[], outPath: string) {
    writeComposite(layerPaths, outPath);
}

export async function show(
    inDir: string,
    showTag: string,
    showAttribs: string[],
    outPath: string | undefined,
) {
    const inPaths = fs
        .readdirSync(inDir)
        .filter((path) => path.endsWith(".png"))
        .map((path) => pathlib.join(inDir, path));
    const layers = inPaths.flatMap((path) => parsePath(path) ?? []);

    const byLeaf: Record<string, LayerInfo[]> = {};
    let matchCount = 0;
    const seenAttribs = new Set<string>();
    for (const layer of layers) {
        if (layer.tag !== showTag) {
            continue;
        }

        for (const attrib of layer.attribs) {
            seenAttribs.add(attrib);
        }

        if (hasOverlap(layer, { tag: showTag, attribs: showAttribs })) {
            const leaf = layer.leaf;
            byLeaf[leaf] ??= [];

            byLeaf[leaf].push(layer);
            matchCount += 1;
        }
    }

    console.log("Missing:");
    for (const attr of showAttribs) {
        if (!seenAttribs.has(attr)) {
            console.log(attr);
        }
    }
    console.log("--");

    console.log("Initial match count", matchCount);

    // Process conflicts
    const initialMatches = Object.entries(byLeaf).flatMap(([, layers]) => layers);
    const noConflicts: LayerInfo[] = [];
    const conflicts = [];
    for (const [, siblings] of Object.entries(byLeaf)) {
        if (siblings.length <= 1) {
            noConflicts.push(...siblings);
        }

        const candidates: LayerInfo[] = [];
        for (const candidate of siblings) {
            const withoutLeaf = candidate.attribs.slice(0, candidate.attribs.length - 1);
            /*
            console.log(
                `hasOverlap(
                    { tag: ${showTag}, attribs: ${showAttribs} },
                    { tag: ${candidate.tag}, attribs: ${withoutLeaf} },
                )`
            );
            */

            if (
                hasOverlap(
                    { tag: showTag, attribs: showAttribs },
                    { tag: candidate.tag, attribs: withoutLeaf },
                )
            ) {
                candidates.push(candidate);
            }
        }

        if (candidates.length > 1) {
            conflicts.push(candidates);
        } else {
            noConflicts.push(...candidates);
        }
    }

    console.log("Post conflict resolution", noConflicts.length);
    diffLayers(initialMatches, noConflicts);
    console.log("--");

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

    // Now eliminate non-leafs except any layers
    const leafs = noConflicts.filter(({ leaf }) => showAttribs.includes(leaf));
    console.log("After eliminating non-leaf", leafs.length);
    diffLayers(noConflicts, leafs);
    console.log("--");

    const layersByTarget: Record<string, LayerInfo[]> = {};
    for (const layer of layers) {
        const { target } = layer;
        if (target) {
            layersByTarget[target] ??= [];
            layersByTarget[target].push(layer);
        }
    }

    // Add all groups
    let kept = [...leafs];
    for (const { attribs } of leafs) {
        for (const attr of attribs) {
            kept.push(...(layersByTarget[attr] ?? []));
        }
    }

    console.log("After adding all groups", kept.length);
    diffLayers(leafs, kept);
    console.log("--");

    kept.sort(({ order: a }, { order: b }) => (a < b ? -1 : a === b ? 0 : 1));
    kept.reverse();

    const seen: Record<string, number> = {};
    const final: LayerInfo[] = [];
    for (const layer of kept) {
        const path = layer.path;
        if (seen[path]) {
            continue;
        }

        seen[path] = 1;
        final.push(layer);
    }

    const paths = final.map(({ path }) => path);
    console.log("After dedup", paths.length);
    console.log("--");

    const finalAttribs = new Set(final.flatMap(({ attribs }) => attribs));
    console.log("Attributes missing from final:");
    for (const attr of showAttribs) {
        if (!finalAttribs.has(attr)) {
            console.log(attr);
        }
    }
    console.log("--");

    console.log("Final:");
    console.log(paths.join("\n"));

    if (outPath) {
        composite(paths, outPath);
    }
}

export async function buildWeb(
    assetsDir: string,
    buildDir: string,
    options: { skipExtract?: boolean },
) {
    const paths = ["images", "gallery.html", "builder.html"] as const;

    const buildPaths = Object.fromEntries(
        paths.map((path) => [path, pathlib.join(buildDir, path)]),
    );
    const webPaths = Object.fromEntries(paths.map((path) => [path, `./${path}`]));

    // Create missing directories
    for (const path of Object.values(buildPaths)) {
        const pathSplit = path.split(pathlib.sep);
        if (pathSplit[pathSplit.length - 1]?.indexOf(".") > 0) {
            pathSplit.pop();
        }

        if (pathSplit.length === 0) {
            continue;
        }

        const dirPath = pathlib.join(...pathSplit);
        fs.mkdirSync(dirPath, { recursive: true });
    }

    if (!options.skipExtract) {
        const psdPaths = fs
            .readdirSync(assetsDir)
            .filter((fileName) => fileName.endsWith(".psd"))
            .map((fileName) => pathlib.join(assetsDir, fileName));

        for (const path of psdPaths) {
            extract(path, buildPaths["images"]);
        }
    }

    const layerPaths = fs
        .readdirSync(buildPaths["images"])
        .filter((path) => path.endsWith(".png"))
        .map((path) => pathlib.join(webPaths["images"], path));

    const layers = layerPaths.flatMap((path) => parsePath(path) ?? []);

    render(buildPaths["gallery.html"], LayerGallery({ layers }));
}

export async function extract(path: string, outDir: string, dry?: boolean) {
    dry ??= false;

    const psdData = fs.readFileSync(path);
    const psdFile = Psd.parse(psdData.buffer);

    let order = 0;
    traversePsd({
        parent: psdFile,
        visitLayer: (layer) => {
            const segments = getLayerSegments(layer);
            const name = buildName(segments, order++);
            const outPath = pathlib.join(outDir, `${name}.png`);

            if (dry) {
                console.log(
                    name,
                    `[blendMode=${layer.layerFrame?.layerProperties?.blendMode}]`,
                );
            } else {
                writeLayer(outPath, layer).catch((err) =>
                    console.error("Failed to write layer.", name, err),
                );
            }
        },
    });
}

export async function inspect(path: string) {
    extract(path, "", true);
}
