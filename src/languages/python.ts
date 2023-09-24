import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { getTempPath } from "../config";
import { Cell } from "../kernel";
import { window } from  "vscode"
import path from "path"

let tempDir = getTempPath();

export let processCellsPython = (cells: Cell[]): {stream: ChildProcessWithoutNullStreams, clearOutput: boolean }=> {
    let innerScope = "";
    let cellCount = 0;
    let clearOutput = false;
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
                let file = line.split(":")[1].trim()
                if (file != "main.py"){
                    let cleaned = ""
                    for(let line2 of lines){
                        if(line2.trim() != 'print("!!output-start-cell")'){
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

            if (i == 1) {
                if (line.startsWith("# clear-output")) {
                    clearOutput = true
                }
            }
            if (line[0] !== " " && i == len && !line.includes("#") && line.trim().split(" ").length == 1 && !line.endsWith(")")) {
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
    return {stream: spawn('python', [mainFile]), clearOutput};
};
