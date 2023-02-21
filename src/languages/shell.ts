import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { mkdirSync, writeFileSync, chmodSync } from "fs";
import { getTempPath } from "../config";
import { Cell, lastRunLanguage } from "../kernel";
import * as vscode from "vscode";

let tempDir = getTempPath();

export const processShell = (cells: Cell[], language: string): ChildProcessWithoutNullStreams => {
    let fileName = vscode.window.activeTextEditor?.document.fileName as string;
    // Get directory by slicing off last slash
    let dir = fileName.substring(0, fileName.lastIndexOf("/"));
    if (dir === "") {
        dir = fileName.substring(0, fileName.lastIndexOf("\\"));
    }
    let main = "";
    for (const cell of cells) {
        main += `#!/bin/${language}\necho '!!output-start-cell'\n`;
        main += `cd ${dir}\n`;
        main += cell.contents;
    }

    let extension = "sh";
    let runCommand = "bash";
    switch (language) {
        case "nushell":
            extension = "nu";
            break;
        case "fish": ;
            extension = "fish";
    }

    // const pathName = `${tempDir}/shell`
    const filename = `${dir}/mdl.${extension}`;
    // mkdirSync(pathName, { recursive: true });
    writeFileSync(filename, main);
    chmodSync(filename, 0o755);

    return spawn(extension, [`${filename}`]);

    // return spawn('cargo', ['run', '--manifest-path', `${tempDir}/rust/Cargo.toml`]);
};

