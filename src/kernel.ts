import { NotebookDocument, NotebookCell, NotebookController, NotebookCellOutput, NotebookCellOutputItem, NotebookRange, } from 'vscode';
import { processCellsRust } from "./languages/rust";
import { fixImportsGo, processCellsGo } from "./languages/go";
import { processCellsJavascript } from "./languages/javascript";
import { processCellsTypescript } from "./languages/typescript";
import { ChildProcessWithoutNullStreams } from 'child_process';

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

        // Allow for the ability to cancel execution
        let token = exec.token;
        token.onCancellationRequested(() => exec.end(false, (new Date).getTime()));

        // Get all cells up to this one
        let range = new NotebookRange(0, cells[0].index + 1);
        let cellsAll = doc.getCells(range);

        // Build a object containing languages and there cells
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

        const runProgram = new Promise((resolve, reject) => {
            let output: ChildProcessWithoutNullStreams;
            switch (cells[0].document.languageId) {
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
                    lastRunLanguage = "typescript";
                    output = processCellsTypescript(cellsStripped);
                    break;
                default:
                    let response = encoder.encode("Language hasn't been implemented yet");
                    const x = new NotebookCellOutputItem(response, "text/plain");
                    exec.appendOutput([new NotebookCellOutput([x])], cells[0]);
                    exec.end(false, (new Date).getTime());
                    return;
            }

            console.log("Running rest of logic");
            let fixingImports = false;
            let currentCell = cellsStripped.pop();

            output.stderr.on("data", async (data: Uint8Array) => {
                if (data.toString().match(/no required module provides/) || data.toString().match(/go: updates to go.mod needed/)) {
                    fixingImports = true;
                    await fixImportsGo(exec, currentCell.cell);
                }
                const x = new NotebookCellOutputItem(data, "text/plain");
                exec.appendOutput([new NotebookCellOutput([x])], currentCell.cell);
            });

            let buf = Buffer.from([]);
            output.stdout.on('data', (data: Uint8Array) => {
                let arr = [buf, data];
                buf = Buffer.concat(arr);
            });

            output.on('close', (code) => {
                if (!fixingImports) {
                    // If stdout returned anything consider it a success 
                    if (buf.length > 0) {
                        let outputs = decoder.decode(buf).split("!!output-start-cell\n");
                        // Async update all the other cells, they'll update in there own time
                        for (let cell of cellsStripped) {
                            exec.clearOutput(cell.cell);
                            const bodyU8 = encoder.encode(outputs[cell.index]);
                            const x = new NotebookCellOutputItem(bodyU8, "text/plain");
                            exec.appendOutput([new NotebookCellOutput([x])], cell.cell);
                        }
                        // This is the cell that's being run, need to await this execution
                        // before calling `exec.end`
                        exec.clearOutput(currentCell.cell);
                        const bodyU8 = encoder.encode(outputs[currentCell.index]);
                        const x = new NotebookCellOutputItem(bodyU8, "text/plain");
                        exec.appendOutput([new NotebookCellOutput([x])], currentCell.cell);
                        exec.end(true, (new Date).getTime());
                    } else {
                        exec.end(false, (new Date).getTime());
                    }
                    console.log(`child process exited with code ${code}`);
                    resolve(0);
                }
            });
        });

        await runProgram;
    }
}

