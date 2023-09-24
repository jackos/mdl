/* eslint-disable @typescript-eslint/naming-convention */
import { NotebookDocument, NotebookCell, NotebookController, NotebookCellOutput, NotebookCellOutputItem, NotebookRange, NotebookEdit, WorkspaceEdit, workspace, window } from 'vscode';
import { processCellsRust } from "./languages/rust";
import { fixImportsGo, processCellsGo } from "./languages/go";
import { processCellsJavascript } from "./languages/javascript";
import { processCellsTypescript } from "./languages/typescript";
import { ChildProcessWithoutNullStreams, spawnSync } from 'child_process';
import { processShell as processShell } from './languages/shell';
import { processCellsPython } from './languages/python';
import * as vscode from 'vscode';
import { processCellsMojo } from './languages/mojo';
import { getOpenAIKey, getOpenAIModel, getOpenAIOrgID } from "./config"
import { execSync } from 'child_process';


export interface Cell {
    index: number;
    contents: string;
    cell: NotebookCell;
}

interface ChatResponse {
    id: string,
    object: string,
    created: number,
    choices: [{
        index: 0,
        message: {
            role: string,
            content: string,
        },
        finish_reason: string
    }],
    usage: {
        prompt_tokens: number,
        completion_tokens: number,
        total_tokens: number
    }
}

interface ChatRequest {
    model: string,
    messages: ChatMessage[]
}

interface ChatMessage {
    role: string,
    content: string,
}

export let lastRunLanguage = '';


function commandNotOnPath(command: string, link: string): boolean {
  try {
    // Use the "where" command on Windows or the "which" command on macOS/Linux
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execSync(`${cmd} ${command}`, { stdio: 'ignore' });
    return false;
  } catch (error) {
    vscode.window.showErrorMessage(`${command} not on path`, ...[`Install ${command}`]).then((_)=>{
        vscode.env.openExternal(vscode.Uri.parse(link));
    });
    return true;
  }
}


let post = async (url, headers, body): Promise<ChatResponse> => {
    try {
        let response = await fetch(url, { headers, body, method: 'POST' });

        // Check if status code starts with 2
        if (response.status >= 300) {
            window.showErrorMessage(`Error getting response: ${response.status}\n${await response.text()}`);
            return {} as ChatResponse;
        }

        let json = await response.json()
        window.showInformationMessage(`Response from openai: ${JSON.stringify(json, null, 2)}`);
        return json as ChatResponse;
        // Proceed with the `result` if needed
    } catch (error) {
        window.showErrorMessage("Error with fetch request:" + error.toString());
        return {} as ChatResponse;
    }
}

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

        const lang = cells[0].document.languageId;

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
        } else {
            let output: ChildProcessWithoutNullStreams;

            const mimeType = `text/plain`;
            let currentCell = cellsStripped[cellsStripped.length - 1] as Cell;
            switch (lang) {
                case "mojo":
                    if (commandNotOnPath('mojo', "https://modular.com/mojo")) {
                        exec.end(false, (new Date).getTime());
                        return
                    }
                    lastRunLanguage = "mojo";
                    output = processCellsMojo(cellsStripped);
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
                    if (commandNotOnPath("python", "https://www.python.org/downloads/")) {
                        exec.end(false, (new Date).getTime());
                        return
                    }
                    lastRunLanguage = "python";
                    output = processCellsPython(cellsStripped);
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
                    lastRunLanguage = "bash";
                    output = processShell(currentCell, lastRunLanguage);
                    break;
                case "fish":
                    lastRunLanguage = "fish";
                    output = processShell(currentCell, lastRunLanguage);
                    break;
                case "nushell":
                    lastRunLanguage = "nushell";
                    output = processShell(currentCell, lastRunLanguage);
                    break;
                case "shellscript":
                    lastRunLanguage = "bash";
                    output = processShell(currentCell, lastRunLanguage);
                    break;
                default:
                    let response = encoder.encode("Language hasn't been implemented yet");
                    const x = new NotebookCellOutputItem(response, mimeType);
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
            let errorText = "";

            output.stderr.on("data", async (data: Uint8Array) => {
                errorText = data.toString();
                exec.appendOutput([new NotebookCellOutput([NotebookCellOutputItem.text(errorText, mimeType)])]);
            });

            let buf = Buffer.from([]);
            output.stdout.on('data', (data: Uint8Array) => {
                let arr = [buf, data];
                buf = Buffer.concat(arr);
                let outputs = decoder.decode(buf).split("!!output-start-cell\n");
                let currentCellOutput = outputs[currentCell.index];
                exec.replaceOutput([new NotebookCellOutput([NotebookCellOutputItem.text(currentCellOutput)])]);
            });

            output.on('close', (_) => {
                if (!fixingImports) {
                    // If stdout returned anything consider it a success
                    if (buf.length === 0) {
                        exec.end(false, (new Date).getTime());
                    } else {
                        exec.end(true, (new Date).getTime());
                    }
                }
            });
        }
    }
}
