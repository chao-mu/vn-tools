import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";

import fs from "fs";
import { parsePath } from "./common/names";
import { buildWeb, composite, extract, inspect, show } from "./server/cli";

function check(checkResults: Record<string, string | null>) {
    for (const [name, reason] of Object.entries(checkResults)) {
        if (reason) {
            return `Invalid value for ${name}: ${reason}`;
        }
    }

    return true;
}

function checkDir(value: string): string | null {
    if (!fs.existsSync(value)) {
        return "Expected existing directory, but it does not exist.";
    }

    const stat = fs.lstatSync(value);
    if (!stat.isDirectory()) {
        return `Path does not lead to a directory. Got: ${value}.`;
    }

    return null;
}

function checkNotExists(value: string): string | null {
    if (fs.existsSync(value)) {
        return `Expected path to not be to an existing file to not exist. Got: ${value}`;
    }

    return null;
}

function checkLayerFile(value: string): string | null {
    const err = checkFile(value);
    if (err !== null) {
        return err;
    }

    if (parsePath(value) === null) {
        return `Expected valid layer name in path. Got: ${value}`;
    }

    return null;
}

function checkFile(value: string): string | null {
    if (!fs.existsSync(value)) {
        return `Expected existing file, but it does not exist. Got: ${value}`;
    }

    const stat = fs.lstatSync(value);
    if (!stat.isFile()) {
        return `Path does not lead to a file. Got: ${value}`;
    }

    return null;
}

yargs(hideBin(process.argv))
    .command(
        "inspect <path>",
        "Print useful information about a photoshop file",
        (yargs) => {
            return yargs
                .positional("path", {
                    describe: "The path to the photoshop file (PSD format)",
                    demandOption: true,
                    type: "string",
                })
                .check(({ path }) =>
                    check({
                        path: checkFile(path),
                    }),
                );
        },
        ({ path }) => {
            inspect(path);
        },
    )
    .command(
        "build-web [assetsDir] [buildDir]",
        "Build the web app given the assets directory",
        (yargs) => {
            return yargs
                .positional("assetsDir", {
                    describe: "The directory of asset files to support build",
                    default: "assets/",
                    type: "string",
                })
                .positional("buildDir", {
                    describe: "The directory of files to serve",
                    default: "dist/",
                    type: "string",
                })
                .option("skipExtract", {
                    describe: "Image output",
                    type: "boolean",
                })
                .check(({ buildDir }) =>
                    check({
                        buildDir: checkDir(buildDir),
                        assetsDir: checkDir(buildDir),
                    }),
                );
        },
        ({ assetsDir, buildDir, skipExtract }) => {
            buildWeb(assetsDir, buildDir, { skipExtract });
        },
    )
    .command(
        "extract <inPath> <outPath>",
        "Extract layers from photoshop file and write them to output dir",
        (yargs) => {
            return yargs
                .positional("inPath", {
                    describe: "The path to the photoshop file (PSD format)",
                    demandOption: true,
                    type: "string",
                })
                .positional("outPath", {
                    describe: "The path to the directory you write the files in",
                    demandOption: true,
                    type: "string",
                })
                .check(({ inPath, outPath }) =>
                    check({
                        inPath: checkFile(inPath),
                        outPath: checkDir(outPath),
                    }),
                );
        },
        ({ inPath, outPath }) => {
            extract(inPath, outPath);
        },
    )
    .command(
        "show <inDir> <tag> [attribs...]",
        "Produce a composite based on tag and attributes",
        (yargs) =>
            yargs
                .positional("inDir", {
                    describe: "Directory to read layers from",
                    demandOption: true,
                    type: "string",
                })
                .positional("tag", {
                    describe: "Image tag",
                    demandOption: true,
                    type: "string",
                })
                .option("out", {
                    describe: "Image output",
                    type: "string",
                })
                .array("attribs")
                .check(({ inDir, out }) =>
                    check({
                        inDir: checkDir(inDir),
                        out: out ? checkNotExists(out) : null,
                    }),
                ),
        ({ inDir, tag, attribs, out }) => {
            const parsedAttribs = (attribs ?? []).map((attr) => attr.toString());
            show(inDir, tag, parsedAttribs, out);
        },
    )
    .command(
        "composite <out> [layers...]",
        "Composite images",
        (yargs) =>
            yargs
                .option("out", {
                    describe: "The file to write composite to",
                    demandOption: true,
                    type: "string",
                })
                .array("layers")
                .check(({ layers, out }) =>
                    check({
                        out: checkNotExists(out),
                        ...Object.fromEntries(
                            (layers ?? []).map((path, idx) => [
                                `path #${idx + 1}`,
                                checkFile(path.toString()),
                            ]),
                        ),
                    }),
                ),
        ({ layers, out }) => {
            composite(
                (layers ?? []).map((layer) => layer.toString()),
                out,
            );
        },
    )
    .demandCommand()
    .strict()
    .parse();
