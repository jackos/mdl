import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { getTempPath } from "../config";
import { Cell, LanguageCommand } from "../types";
import vscode from "vscode"
import path from "path"

let tempDir = getTempPath();

export let processCellsPython = (cells: Cell[], command: string): { stream: ChildProcessWithoutNullStreams, clearOutput: boolean } => {

    let innerScope = "";
    let cellCount = 0;
    let clearOutput = false;
    const activeFilePath = path.dirname(vscode.window.activeTextEditor?.document.uri.fsPath as string);
    for (const cell of cells) {
        innerScope += `\nprint("!!output-start-cell", flush=True)\n`;
        cell.contents = cell.contents.trim();

        const regex = /(\s*print\s*\()(.*?)(\)\s*$)/gm;

        cell.contents = cell.contents.replace(regex, (_, before, content, after) => {
            // Check if 'flush=True' is already present
            if (!content.includes('flush=True')) {
                if (content.trim()) { // If there's content inside the print statement, add ', flush=True'
                    content += ", flush=True";
                } else { // If the print statement is empty, just add 'flush=True'
                    content = "flush=True";
                }
            }
            return `${before}${content}${after}`;
        });
        cellCount++;
        if (cell.cell.metadata.startsWith(LanguageCommand.skip)) {
            continue;
        }
        let lines = cell.contents.split("\n");
        const len = lines.length;
        let i = 0
        for (let line of lines) {
            i++
            if (i == 1 && line.replace(/\s/g, "").substring(0, 6) == "#file:") {
                let file = line.split(":")[1].trim()
                if (file != "main.py") {
                    let cleaned = ""
                    for (let line2 of lines) {
                        if (line2.trim() != 'print("!!output-start-cell", flush=True)') {
                            cleaned += line2 + "\n"
                        }
                    }
                    if (path.isAbsolute(file)) {
                        writeFileSync(file, cleaned);
                    } else {
                        writeFileSync(path.join(tempDir, file), cleaned);
                    }
                }
                continue
            }

            if (i == 1 && cellCount == cells.length && cell.cell.metadata.command.startsWith(LanguageCommand.clear)) {
                clearOutput = true
            }
            if (line[0] !== " " && i == len && !line.includes("#") && line.trim().split(" ").length == 1 && !line.endsWith(")")) {
                // if first char is `!` pretty print
                if (line[0] === "!") {
                    innerScope += "from pprint import pprint\n";
                    line = "pprint(" + line.substring(1) + ", flush=True)";
                } else {
                    line = "print(" + line + ", flush=True)";
                }


            }
            innerScope += line + "\n";
        }
    };

    let mainFile = path.join(tempDir, "mdlab.py");
    let header = `import sys\nsys.path.append("${activeFilePath}")\nsys.path.append("${tempDir}")\nfrom builtins import *\n`

    mkdirSync(tempDir, { recursive: true });
    writeFileSync(mainFile, header + innerScope);

    return { stream: spawn(command, [mainFile], { cwd: activeFilePath }), clearOutput };
};
