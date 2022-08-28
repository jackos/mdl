import { NotebookDocument, NotebookCell, NotebookController, NotebookCellOutput, NotebookCellOutputItem, NotebookRange, } from 'vscode';
import { processCellsRust } from "./languages/rust";
import { fixImportsGo, processCellsGo } from "./languages/go";
import { processCellsJavascript } from "./languages/javascript";
import { processCellsTypescript } from "./languages/typescript";
import { ChildProcessWithoutNullStreams, spawnSync } from 'child_process';
import { processShell as processShell } from './languages/shell';

export interface Cell {
    index: number;
    contents: string;
    cell: NotebookCell;
}

export let lastRunLanguage = '';

export class Kernel {
    // Use the same code for Run All, just takes the last cell
    async executeCells(doc: NotebookDocument, cells: NotebookCell[], ctrl: NotebookController): Promise<void> {
        for (const cell of cells) {
            this.executeCell(doc, [cell], ctrl);
        }
    }

    async executeCell(doc: NotebookDocument, cells: NotebookCell[], ctrl: NotebookController): Promise<void> {
        let decoder = new TextDecoder;
        let encoder = new TextEncoder;
        let exec = ctrl.createNotebookCellExecution(cells[0]);

        // Used for the cell timer counter
        exec.start((new Date).getTime());
        exec.clearOutput(cells[0]);


        // Get all cells up to this one
        let range = new NotebookRange(0, cells[0].index + 1);
        let cellsAll = doc.getCells(range);

        // Build a object containing languages and their cells
        let cellsStripped: Cell[] = [];
        let matchingCells = 0;
        for (const cell of cellsAll) {
            if (cell.document.languageId === cells[0].document.languageId) {
                matchingCells++;
                cellsStripped.push({
                    index: matchingCells,
                    contents: cell.document.getText(),
                    cell: cell,
                });
            }
        }

        const runProgram = new Promise((resolve, _) => {
            let output: ChildProcessWithoutNullStreams;
            const lang = cells[0].document.languageId
            const mimeType = `text/plain`
            switch (lang) {
                case "rust":
                    lastRunLanguage = "rust";
                    output = processCellsRust(cellsStripped);
                    break;
                case "go":
                    lastRunLanguage = "go";
                    output = processCellsGo(cellsStripped);
                    break;
                case "javascript":
                    lastRunLanguage = "javascript";
                    output = processCellsJavascript(cellsStripped);
                    break;
                case "typescript":
                    let esr = spawnSync("esr");
                    if (esr.stdout === null) {
                        let response = encoder.encode("To make TypeScript run fast install esr globally:\nnpm install -g esbuild-runner");
                        const x = new NotebookCellOutputItem(response, "text/plain");
                        exec.appendOutput([new NotebookCellOutput([x])], cells[0]);
                        exec.end(false, (new Date).getTime());
                        return;
                    }
                    lastRunLanguage = "typescript";
                    output = processCellsTypescript(cellsStripped);
                    break;
                case "bash":
                    lastRunLanguage = "bash";
                    output = processShell(cellsStripped, lastRunLanguage);
                    break;
                case "fish":
                    lastRunLanguage = "fish";
                    output = processShell(cellsStripped, lastRunLanguage);
                    break;
                case "nushell":
                    lastRunLanguage = "nushell";
                    output = processShell(cellsStripped, lastRunLanguage);
                    break;
                case "shellscript":
                    lastRunLanguage = "bash";
                    output = processShell(cellsStripped, lastRunLanguage);
                    break;
                default:
                    let response = encoder.encode("Language hasn't been implemented yet");
                    const x = new NotebookCellOutputItem(response, "text/plain");
                    exec.appendOutput([new NotebookCellOutput([x])], cells[0]);
                    exec.end(false, (new Date).getTime());
                    return;
            }
            // Allow for the ability to cancel execution
            let token = exec.token;
            token.onCancellationRequested(() => {
                output.kill();
                exec.end(false, (new Date).getTime());
            });

            let fixingImports = false;
            let currentCell = cellsStripped.pop();
            let errorText = "";

            output.stderr.on("data", async (data: Uint8Array) => {
                if (data.toString().match(/no required module provides/) || data.toString().match(/go: updates to go.mod needed/)) {
                    fixingImports = true;
                    await fixImportsGo(exec, currentCell.cell);
                }
                errorText = data.toString();
                exec.appendOutput([new NotebookCellOutput([NotebookCellOutputItem.text(errorText, mimeType)])])
            });

            let buf = Buffer.from([]);
            output.stdout.on('data', (data: Uint8Array) => {
                let arr = [buf, data];
                buf = Buffer.concat(arr);
                let outputs = decoder.decode(buf).split("!!output-start-cell\n");
                let currentCellOutput = outputs[currentCell.index]
                // currentCellOutput += errorText;
                exec.replaceOutput([new NotebookCellOutput([NotebookCellOutputItem.text(currentCellOutput)])])
            });

            output.on('close', (_) => {
                if (!fixingImports) {
                    // If stdout returned anything consider it a success
                    if (buf.length == 0) {
                        exec.end(false, (new Date).getTime());
                    } else {
                        exec.end(true, (new Date).getTime());
                    }
                    resolve(0);
                }
            });
        });
        await runProgram;
    }
}
