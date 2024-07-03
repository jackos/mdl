import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { getTempPath, modularHome } from "../config";
import { Cell, CommentDecorator } from "../types";
import path from "path";
import { window } from "vscode";
import { processCellsPython } from "./python";
import { commandNotOnPath } from "../utils";

let tempDir = getTempPath();

export let processCellsMojo = (cells: Cell[], pythonCells: Cell[]): { stream: ChildProcessWithoutNullStreams, clearOutput: boolean } => {
    // If any python cells exist, make sure the generated file is current
    if (pythonCells) {
        let command = "python3"
        if (commandNotOnPath(command, "")) {
            command = "python"
        }
        processCellsPython(pythonCells, command)
    }
    const activeFilePath = path.dirname(window.activeTextEditor?.document.uri.fsPath as string);
    let outerScope = "";

    let innerScope = `def main():`;

    let pythonFileExists = existsSync(path.join(tempDir, "mdl.py"));
    if (pythonFileExists) {
        outerScope += "from python import Python\n"
        innerScope += `\n    sys = Python.import_module("sys")\n    sys.path.append("${activeFilePath}")\n    sys.path.append("${tempDir}")\n    py = Python.import_module("mdl")\n`
    }
    let cellCount = 0;
    let clearOutput = false;
    let inOuterScope = false;

    for (const cell of cells) {
        innerScope += `\n    print("!!output-start-cell")\n`;
        // cell.contents = cell.contents.trim();
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
        if (cell.contents.startsWith("#mdl:skip") || cell.contents.startsWith("# mdl:skip")) {
            continue;
        }
        let lines = cell.contents.split("\n");
        const len = lines.length;
        let i = 0
        for (let line of lines) {
            i++
            // Keep things in outerScope if they should not go in main()
            if (
                line.startsWith("struct") ||
                line.startsWith("trait") ||
                line.startsWith("fn") ||
                line.startsWith("alias") ||
                line.startsWith("from") ||
                line.startsWith("import") ||
                line.startsWith("@")
            ) {
                inOuterScope = true;
            } else if (!line.startsWith("  ") && !(line === "")) {
                inOuterScope = false;
            }
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
            if (line.startsWith("fn main():") || line.startsWith("def main():")) {
                continue;
            }
            if (pythonFileExists && (line.includes('Python.import_module("sys")') || line.trim() == "from python import Python")) {
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
            if (inOuterScope) {
                outerScope += line + "\n"
            } else {
                innerScope += "    " + line + "\n";

            }
        }
    };


    let mainFile = path.join(tempDir, "main.mojo");

    mkdirSync(tempDir, { recursive: true });
    writeFileSync(mainFile, outerScope + innerScope);
    let env = process.env;
    if (typeof modularHome === "string") {
        env = { "MODULAR_HOME": modularHome, ...env }
    }

    return { stream: spawn('mojo', [mainFile], { cwd: activeFilePath, env }), clearOutput };
};
