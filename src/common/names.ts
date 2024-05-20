import pathlib from "path";

export type LayerInfo = {
    segments: string[];
    path: string;
    tag: string;
    name: string;
    attribs: string[];
    leaf: string;
    order: number;
    target: string | undefined;
};

const SectionSep = "__";

function isAllAttr(attr: string): boolean {
    return !!attr.match(/^(all|all[-_]\d+)$/i);
}

export function parsePath(path: string): LayerInfo | null {
    const { name: fileName } = pathlib.parse(path);
    const [segmentSection, orderSection] = fileName.split(SectionSep);

    const order = Number(orderSection);

    const segments = segmentSection
        .split(/\s*::\s*/)
        .map((seg) => seg.toLowerCase())
        .map((seg) => seg.replaceAll(/\s+/g, "_"));
    const [tag, ...attribs] = segments;

    const lastAllIndex = attribs.findLastIndex((attr) => isAllAttr(attr));

    return {
        path,
        attribs,
        segments,
        tag,
        order,
        target: attribs[lastAllIndex - 1],
        leaf: attribs[attribs.length - 1],
        name: buildName(segments, order),
    };
}

export const diffLayers = (a: LayerInfo[], b: LayerInfo[]) => {
    const aPaths = new Set(a.map(({ path }) => path));

    for (const { path } of b) {
        if (aPaths.has(path)) {
            continue;
        } else {
            console.log(`+ ${path}`);
        }
    }

    const bPaths = new Set(b.map(({ path }) => path));
    for (const { path } of a) {
        if (bPaths.has(path)) {
            continue;
        } else {
            console.log(`- ${path}`);
        }
    }
};

export function buildName(segments: string[], order: number) {
    return [segments.join(" :: "), order].join(SectionSep);
}

export function hasOverlap(
    a: { tag: string; attribs: string[] },
    b: { tag: string; attribs: string[] },
) {
    return a.tag === b.tag && a.attribs.some((attr) => b.attribs.includes(attr));
}
