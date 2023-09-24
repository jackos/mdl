import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { writeFileSync, chmodSync, mkdirSync } from "fs";
import { getTempPath } from "../config";
import { Cell } from "../kernel";
import * as vscode from "vscode";
import path from "path";
import { NotebookCell } from "vscode";

let tempDir = getTempPath();

export const processShell = (cell: NotebookCell, language: string): ChildProcessWithoutNullStreams => {
    let prog = ""
    switch(language){
        case "nushell":
            prog = "nu";
            break;
        case "fish":
            prog = "fish";
            break;
        default:
            prog = "bash";
            break;
    }

    let fileName = vscode.window.activeTextEditor?.document.fileName as string;
    // Get directory by slicing off last slash
    let dir = fileName.substring(0, fileName.lastIndexOf("/"));
    if (dir === "") {
        dir = fileName.substring(0, fileName.lastIndexOf("\\"));
    }
    let main = "";
    // Ignore all the clutter from the generated files when running tree
    let contents = cell.document.getText().trim();
    if (contents.endsWith("tree")) {
        contents = "tree -I '__pycache__|main.sh|main.fish|main.nu|target'"
    }
    main += `#!/bin/${language}\necho '!!output-start-cell'\n`;
    main += contents;


    const filename = path.join(tempDir, `main`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(filename, main);
    chmodSync(filename, 0o755);

    return spawn(prog, [filename], {cwd: tempDir});
};

