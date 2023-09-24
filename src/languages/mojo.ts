import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { getTempPath } from "../config";
import { Cell } from "../kernel";
import path from "path";
import {window} from "vscode";

let tempDir = getTempPath();

export let processCellsMojo = (cells: Cell[]): ChildProcessWithoutNullStreams => {
    let innerScope = "";
    let cellCount = 0;
    let writeAdditionalFile = ""

    for (const cell of cells) {
        cell.contents = cell.contents.trim();
        cellCount++;
        innerScope += `\n    print("!!output-start-cell")\n`;
        let lines = cell.contents.split("\n");
        const len = lines.length;
        let i = 0
        for (let line of lines) {
            i++
            if (i==1 && line.replace(/\s/g, "").substring(0, 6) == "#file:") {
                writeAdditionalFile = line.split(":")[1].trim()
            }
            if (line.trim() == "from python import Python") {
                continue
            }
            if (line.startsWith("fn main():") || line.startsWith("def main():")) {
                continue;
            }

            if (line.length > 0 && line[0] !== " " && line[line.length - 1] != ")" && i == len && !line.includes("#")) {
                // if first char is `!` pretty print
                if (line[0] === "!") {
                    innerScope += `let pprint = Python.import_module("pprint")\n`;
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
    let header = `def main():\n    from python import Python\n    let sys = Python.import_module("sys")\n    sys.path.append("${activeFilePath}")\n    sys.path.append("${tempDir}")\n`
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(mainFile, header + innerScope);
    if(writeAdditionalFile) {
        writeFileSync(path.join(tempDir, writeAdditionalFile), header + innerScope);
    }

    return spawn('mojo', [mainFile]);
};
