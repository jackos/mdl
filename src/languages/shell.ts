import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { writeFileSync, chmodSync, mkdirSync } from "fs";
import { getTempPath } from "../config";
import { Cell } from "../kernel";
import * as vscode from "vscode";
import path from "path";

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
        main += cell.contents;
    }

    let extension = "";
    let runner = "";
    switch (language) {
        case "nushell":
            extension = "nu";
            runner = "nu"
            break;
        case "fish":
            extension = "fish";
            runner = "fish";
            break;
        default:
            extension = "sh";
            runner = "bash"
            break;
    }

    const filename = path.join(tempDir, `main.${extension}`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(filename, main);
    chmodSync(filename, 0o755);

    return spawn(runner, [filename], {cwd: tempDir});
};

