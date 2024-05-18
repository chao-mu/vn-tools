import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";

import fs from "fs";
import { composite, extract, inspect, writeIndex } from "./api/cli";

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
        return "Path does not lead to a directory.";
    }

    return null;
}

function checkNotExists(value: string): string | null {
    if (fs.existsSync(value)) {
        return `Expected path to not be to an existing file to not exist. Got: ${value}`;
    }
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
        "build-index <inPath> [outPath]",
        "Build an index from the directory of images",
        (yargs) => {
            return yargs
                .positional("inPath", {
                    describe: "The images directory",
                    demandOption: true,
                    type: "string",
                })
                .positional("outPath", {
                    describe: "The path where you want to write the index file",
                    type: "string",
                })
                .check(({ inPath }) =>
                    check({
                        inPath: checkDir(inPath),
                    }),
                );
        },
        ({ inPath, outPath }) => {
            writeIndex(inPath, outPath);
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
        "composite <out> [layers...]",
        "Composite layers",
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
