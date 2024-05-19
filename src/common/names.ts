import pathlib from "path";

export type LayerInfo = {
    segments: string[];
    path: string;
    tag: string;
    name: string;
    attribs: string[];
    stem: string;
    isAll: boolean;
};

export function parsePath(path: string): LayerInfo | null {
    const parsed = pathlib.parse(path);
    const segments = parsed.name.split(" :: ").map((seg) => seg.toLowerCase());
    const [tag, ...attribs] = segments;

    return {
        path,
        attribs,
        segments,
        tag,
        isAll: attribs.some((attr) => attr === "all" || attr.startsWith("all-")),
        stem: attribs[attribs.length - 1],
        name: buildName(segments),
    };
}

export function buildName(segments: string[]) {
    return segments.join(" :: ");
}

export function hasOverlap(
    a: { tag: string; attribs: string[] },
    b: { tag: string; attribs: string[] },
) {
    return a.tag === b.tag && a.attribs.some((attr) => b.attribs.includes(attr));
}
