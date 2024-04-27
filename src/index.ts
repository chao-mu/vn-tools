import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";

import fs from "fs";
import { compositePermutations, extractLayers, inspectPsd } from "./api";

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
            inspectPsd(path);
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
            extractLayers(inPath, outPath);
        },
    )
    .command(
        "composite <inPath> <outPath>",
        "Composite layers found in directory inPath and output combonations to outPath",
        (yargs) => {
            return yargs
                .positional("inPath", {
                    describe: "The path to the directory of layers",
                    demandOption: true,
                    type: "string",
                })
                .positional("outPath", {
                    describe: "The path to the directory to write composites to",
                    demandOption: true,
                    type: "string",
                })
                .check(({ inPath, outPath }) =>
                    check({
                        inPath: checkDir(inPath),
                        outPath: checkDir(outPath),
                    }),
                );
        },
        ({ inPath, outPath }) => {
            compositePermutations(inPath, outPath);
        },
    )
    .demandCommand()
    .strict()
    .parse();
