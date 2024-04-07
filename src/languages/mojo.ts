import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { getTempPath } from "../config";
import { Cell, CommentDecorator } from "../types";
import path from "path";
import { window } from "vscode";

let tempDir = getTempPath();

export let processCellsMojo = (cells: Cell[]): { stream: ChildProcessWithoutNullStreams, clearOutput: boolean } => {
    let innerScope = "";
    let cellCount = 0;
    let clearOutput = false;

    for (const cell of cells) {
        cell.contents = cell.contents.trim();
        cellCount++;
        innerScope += `\n    print("!!output-start-cell")\n`;
        let lines = cell.contents.split("\n");
        const len = lines.length;
        let i = 0
        for (let line of lines) {
            i++
            if (i == 1 && line.replace(/\s/g, "").substring(0, 6) == "#file:") {
                let file = line.split(":")[1].trim()
                if (file != "main.mojo") {
                    let cleaned = ""
                    for (let line2 of lines) {
                        if (line2.trim() != 'print("!!output-start-cell")') {
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
            if (i == 1 && cellCount == cells.length && line.startsWith('# ' + CommentDecorator.clear)) {
                clearOutput = true
            }
            if (
                line.startsWith("fn main():") ||
                line.startsWith("def main():") ||
                line.includes('Python.import_module("sys")') ||
                line.trim() == "from python import Python"
            ) {
                continue;
            }
            if (line[0] !== " " && i == len && !line.includes("#") && line.trim().split(" ").length == 1 && !line.endsWith(")")) {
                // if first char is `!` pretty print
                if (line[0] === "!") {
                    innerScope += `    let pprint = Python.import_module("pprint")\n`;
                    line = "pprint(" + line.substring(1) + ")";
                } else {
                    line = "print(" + line + ")";
                }

            }
            innerScope += "    " + line + "\n";
        }
    };

    let mainFile = path.join(tempDir, "main.mojo");
    const activeFilePath = path.dirname(window.activeTextEditor?.document.uri.fsPath as string);
    let header = `def main():\n    from python import Python\n    sys = Python.import_module("sys")\n    sys.path.append("${activeFilePath}")\n    sys.path.append("${tempDir}")\n`

    mkdirSync(tempDir, { recursive: true });
    writeFileSync(mainFile, header + innerScope);

    return { stream: spawn('mojo', [mainFile], { env: process.env }), clearOutput };
};
