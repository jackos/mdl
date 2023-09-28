import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { writeFileSync, chmodSync, mkdirSync } from "fs";
import { getTempPath } from "../config";
import * as vscode from "vscode";
import path from "path";
import { NotebookCell } from "vscode";
import { CommentDecorator } from "../types";
import { env_before, env_after } from "./shell-scripts"

let tempDir = getTempPath();

export const processShell = (cell: NotebookCell, language: string): {stream: ChildProcessWithoutNullStreams, clearOutput: boolean } => {
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
    let contents = cell.document.getText();
    
    if (contents.trim() == "tree") {
        writeFileSync(path.join(tempDir, ".gitignore"), `env_before.txt
env_after.txt
env_changes.sh
main
__pycache__
rust/target
venv
        `);
        contents = "tree --gitignore"
    }

    // Save and load env vars on each shell incarnation
    main += env_before + contents + env_after

    let clearOutput = false;
    if(contents.startsWith("# " + CommentDecorator.clear)){
        clearOutput = true
    }

    const filename = path.join(tempDir, `main`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(filename, main);
    chmodSync(filename, 0o755);

    return {stream: spawn(prog, [filename], {cwd: tempDir}), clearOutput};
};

