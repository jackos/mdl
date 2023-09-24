import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { getTempPath } from "../config";
import { Cell } from "../kernel";
import { window } from  "vscode"
import path from "path"

let tempDir = getTempPath();

export let processCellsPython = (cells: Cell[]): ChildProcessWithoutNullStreams => {
    let innerScope = "";
    let cellCount = 0;
    let writeAdditionalFile = ""
    const activeFilePath = path.dirname(window.activeTextEditor?.document.uri.fsPath as string);
    for (const cell of cells) {
        innerScope += `\nprint("!!output-start-cell")\n`;
        cell.contents = cell.contents.trim();
        cellCount++;
        let lines = cell.contents.split("\n");
        const len = lines.length;
        let i = 0
        for (let line of lines) {
            i++
            if (i==1 && line.replace(/\s/g, "").substring(0, 6) == "#file:") {
                writeAdditionalFile = line.split(":")[1].trim()
            }
            if (line.length > 0 && line[0] !== " " && line[line.length - 1] != ")" && i == len && !line.includes("#")) {
                // if first char is `!` pretty print
                if (line[0] === "!") {
                    innerScope += "from pprint import pprint\n";
                    line = "pprint(" + line.substring(1) + ")";
                } else {
                    line = "print(" + line + ")";
                }

            }
            innerScope += line + "\n";
        }
    };

    let mainFile = path.join(tempDir, "main.py");
    let header = `import sys\nsys.path.append("${activeFilePath}")\nsys.path.append("${tempDir}")`

    mkdirSync(tempDir, { recursive: true });
    writeFileSync(mainFile, header + innerScope);
    if(writeAdditionalFile) {
        writeFileSync(path.join(tempDir, writeAdditionalFile), header + innerScope);
    }

    return spawn('python', [mainFile]);
};
