/* eslint-disable @typescript-eslint/naming-convention */
import { NotebookDocument, NotebookCell, NotebookController, NotebookCellOutput, NotebookCellOutputItem, NotebookRange, NotebookEdit, WorkspaceEdit, workspace } from 'vscode';
import { processCellsRust } from "./languages/rust";
import { processCellsGo } from "./languages/go";
import { processCellsJavascript } from "./languages/javascript";
import { processCellsTypescript } from "./languages/typescript";
import { ChildProcessWithoutNullStreams, spawnSync } from 'child_process';
import { processShell as processShell } from './languages/shell';
import { processCellsPython } from './languages/python';
import * as vscode from 'vscode';
import { processCellsMojo } from './languages/mojo';
import { getOpenAIKey, getOpenAIModel, getOpenAIOrgID } from "./config"

import { Cell, ChatMessage, ChatRequest, CommentDecorator } from "./types"
import { commandNotOnPath, post } from './utils';


export let lastRunLanguage = '';

// Kernel in this case matches Jupyter definition i.e. this is responsible for taking the frontend notebook
// and running it through different languages, then returning results in the same format.
export class Kernel {
    async executeCells(doc: NotebookDocument, cells: NotebookCell[], ctrl: NotebookController): Promise<void> {
        for (const cell of cells) {
            await this.executeCell(doc, [cell], ctrl)
        }
    }

    async executeCell(doc: NotebookDocument, cells: NotebookCell[], ctrl: NotebookController): Promise<void> {
        let decoder = new TextDecoder;
        let encoder = new TextEncoder;
        let exec = ctrl.createNotebookCellExecution(cells[0]);

        let currentCell = cells[cells.length - 1];
        // Allow for the ability to cancel execution
        let token = exec.token;
        token.onCancellationRequested(() => {
            exec.end(false, (new Date).getTime());
        });

        // Used for the cell timer counter
        exec.start((new Date).getTime());
        // TODO check lang and change comment symbols
        if (currentCell.document.getText().trimStart().startsWith("#" + CommentDecorator.skip)) {
            exec.end(true, (new Date).getTime());
            return
        }
        exec.clearOutput(cells[0]);

        // Get all cells up to this one
        let range = new NotebookRange(0, cells[0].index + 1);
        let cellsUpToCurrent = doc.getCells(range);
        let cellsAll = doc.getCells();

        // Build a object containing languages and their cells
        let cellsStripped: Cell[] = [];
        let matchingCells = 0;
        for (const cell of cellsUpToCurrent) {
            if (cell.document.languageId === cells[0].document.languageId) {
                matchingCells++;
                cellsStripped.push({
                    index: matchingCells,
                    contents: cell.document.getText(),
                    cell: cell,
                });
            }
        }

        // Get language that was used to run this cell
        const lang = cells[0].document.languageId;

        // Check if clearing output at the end
        let clearOutput = false;

        // AI Model related, generates new code blocks, may expand this later
        if (lang === "openai") {
            lastRunLanguage = "openai";
            const url = 'https://api.openai.com/v1/chat/completions';
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getOpenAIKey()}`,
            };
            let orgId = getOpenAIOrgID()
            let model = getOpenAIModel() || "oh no what wrong"
            if (orgId) {
                headers['OpenAI-Organization'] = orgId
            }
            const messages: ChatMessage[] = [{ role: "system", content: "You are a helpful bot named md-notebook, that generates concise code blocks to solve programming problems" }];
            for (const message of cellsStripped) {
                messages.push({ role: "user", content: message.contents });
            }
            const data: ChatRequest = {
                model,
                messages
            };

            let body = JSON.stringify(data);


            let result = await post(url, headers, body)
            if (!result) {
                exec.end(false, (new Date).getTime());
                return
            }

            let text = result.choices[0].message.content;
            let code_blocks = text.split("```");

            let edits: vscode.NotebookCellData[] = [];
            for (let [i, block] of code_blocks.entries()) {
                // If there was any text after split, get the type of language
                if (block[0] != "\n" && i != 0) {
                    let language = block.split("\n")[0]
                    block = block.substring(language.length);
                    let blockTrimmed = block.trim().replace("\n\n", "");
                    edits.push(new vscode.NotebookCellData(vscode.NotebookCellKind.Code, blockTrimmed, language));
                }
                else {
                    let blockTrimmed = block.trim().replace("\n\n", "");
                    edits.push(new vscode.NotebookCellData(vscode.NotebookCellKind.Markup, blockTrimmed, "markdown"));
                }

            }
            const edit = new WorkspaceEdit();
            let notebook_edit = NotebookEdit.insertCells(cells[0].index + 1, edits);
            edit.set(cells[0].notebook.uri, [notebook_edit]);
            workspace.applyEdit(edit);
            exec.end(true, (new Date).getTime());

            // Normal language related execution
        } else {
            let output: ChildProcessWithoutNullStreams;

            // Now there's an output stream, kill that as well on cancel request
            token.onCancellationRequested(() => {
                output.kill();
                exec.end(false, (new Date).getTime());
            });

            const mimeType = `text/plain`;
            switch (lang) {
                case "mojo":
                    if (commandNotOnPath('mojo', "https://modular.com/mojo")) {
                        exec.end(false, (new Date).getTime());
                        return
                    }
                    lastRunLanguage = "mojo";
                    let mojoResult = processCellsMojo(cellsStripped);
                    output = mojoResult.stream
                    clearOutput = mojoResult.clearOutput
                    break;
                case "rust":
                    if (commandNotOnPath('cargo', "https://rustup.rs")) {
                        exec.end(false, (new Date).getTime());
                        return
                    }
                    lastRunLanguage = "rust";
                    output = processCellsRust(cellsStripped);
                    break;
                case "go":
                    if (commandNotOnPath("go", "https://go.dev/doc/install")) {
                        exec.end(false, (new Date).getTime());
                        return
                    }
                    lastRunLanguage = "go";
                    output = processCellsGo(cellsStripped);
                    break;
                case "python":
                    let command = "python"
                    if (commandNotOnPath(command, "")) {
                        if (commandNotOnPath("python3", "https://www.python.org/downloads/")) {
                            exec.end(false, (new Date).getTime());
                            return
                        } else {
                            command = "python3"
                        }
                    }
                    lastRunLanguage = "python";
                    let pyResult = processCellsPython(cellsStripped, command);
                    output = pyResult.stream
                    clearOutput = pyResult.clearOutput
                    break;
                case "javascript":
                    if (commandNotOnPath("node", "https://nodejs.org/en/download/package-manager")) {
                        exec.end(false, (new Date).getTime());
                        return
                    }
                    lastRunLanguage = "javascript";
                    output = processCellsJavascript(cellsStripped);
                    break;
                case "typescript":
                    let esr = spawnSync("esr");
                    if (esr.stdout === null) {
                        let response = encoder.encode("To make TypeScript run fast install esr globally:\nnpm install -g esbuild-runner");
                        const x = new NotebookCellOutputItem(response, mimeType);
                        exec.appendOutput([new NotebookCellOutput([x])], cells[0]);
                        exec.end(false, (new Date).getTime());
                        return;
                    }
                    lastRunLanguage = "typescript";
                    output = processCellsTypescript(cellsStripped);
                    break;
                case "bash":
                    if (commandNotOnPath("bash", "https://hackernoon.com/how-to-install-bash-on-windows-10-lqb73yj3")) {
                        exec.end(false, (new Date).getTime());
                        return
                    }
                    lastRunLanguage = "shell";
                    var result = processShell(currentCell, "bash");
                    output = result.stream
                    clearOutput = result.clearOutput
                    break;
                case "zsh":
                    if (commandNotOnPath("zsh", "https://github.com/ohmyzsh/ohmyzsh/wiki/Installing-ZSH")) {
                        exec.end(false, (new Date).getTime());
                        return
                    }
                    lastRunLanguage = "shell";
                    var result = processShell(currentCell, "zsh");
                    output = result.stream
                    clearOutput = result.clearOutput
                    break;
                case "fish":
                    if (commandNotOnPath("fish", "https://fishshell.com/")) {
                        exec.end(false, (new Date).getTime());
                        return
                    }
                    lastRunLanguage = "shell";
                    var result = processShell(currentCell, "fish");
                    output = result.stream
                    clearOutput = result.clearOutput
                    break;
                case "nushell":
                    if (commandNotOnPath("nushell", "https://www.nushell.sh/book/installation.html")) {
                        exec.end(false, (new Date).getTime());
                        return
                    }
                    lastRunLanguage = "shell";
                    var result = processShell(currentCell, "nushell");
                    output = result.stream
                    clearOutput = result.clearOutput
                    break;
                case "shellscript":
                    if (commandNotOnPath("bash", "https://hackernoon.com/how-to-install-bash-on-windows-10-lqb73yj3")) {
                        exec.end(false, (new Date).getTime());
                        return
                    }
                    lastRunLanguage = "shell";

                    var result = processShell(currentCell, "bash");
                    output = result.stream
                    clearOutput = result.clearOutput
                    break;
                default:
                    exec.end(true, (new Date).getTime());
                    return;
            }

            let errorText = "";

            output.stderr.on("data", async (data: Uint8Array) => {
                errorText = data.toString();
                if (errorText) {
                    exec.appendOutput([new NotebookCellOutput([NotebookCellOutputItem.text(errorText, mimeType)])]);
                }
                
            });

            let buf = Buffer.from([]);

            let currentCellLang = cellsStripped[cellsStripped.length - 1] as Cell;

            output.stdout.on('data', (data: Uint8Array) => {
                let arr = [buf, data];
                buf = Buffer.concat(arr);
                let outputs = decoder.decode(buf).split("!!output-start-cell\n");
                let currentCellOutput: string
                if (lastRunLanguage == "shell") {
                    currentCellOutput = outputs[1]
                } else {
                    currentCellOutput = outputs[currentCellLang.index];
                }
                if (!clearOutput && currentCellOutput.trim()) {
                    exec.replaceOutput([new NotebookCellOutput([NotebookCellOutputItem.text(currentCellOutput)])]);
                }
                
            });

            output.on('close', (_) => {
                // If stdout returned anything consider it a success
                if (buf.length === 0) {
                    exec.end(false, (new Date).getTime());
                } else {
                    exec.end(true, (new Date).getTime());
                }

                // Loop through all the cells and increment version of image if it exists
                for (const [i, cell] of cellsAll.entries()) {
                    let text = cell.document.getText();
                    text.replace(/<img src="(.*?)(\?version=(\d+))?"(.*)/g, (match, prefix, versionQuery, versionNum, suffix) => {
                        if(match) {
                            let replaceText = ""
                            vscode.window.showInformationMessage(`prefix=${prefix} versionQuery=${versionQuery} version=${versionNum} suffix=${suffix}`)
                            if (versionQuery) {
                            //   If ?version= is present, increment the version number
                                let newVersionNum = parseInt(versionNum, 10) + 1;
                                replaceText = `<img src="${prefix}?version=${newVersionNum}"${suffix}`;
                            } else {
                            //   If ?version= is not present, add ?version=1
                                replaceText = `<img src="${prefix}?version=1"${suffix}`;
                            }
                            let edits: vscode.NotebookCellData[] = [];
                            edits.push(new vscode.NotebookCellData(vscode.NotebookCellKind.Markup, replaceText, "markdown"));
                            const edit = new WorkspaceEdit();
                            let notebook_edit = NotebookEdit.replaceCells(new NotebookRange(i, i + 1), edits);
                            edit.set(cellsAll[i].notebook.uri, [notebook_edit]);
                            workspace.applyEdit(edit);
                        }
                    });
                }
            });
        }
    }
}
