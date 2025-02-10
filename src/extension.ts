import { parseMarkdown, writeCellsToMarkdown, RawNotebookCell, LANG_IDS } from './markdownParser';
import { searchNotes } from './commands/search';
import { Kernel } from './kernel';
import * as vscode from 'vscode';
import { openMain } from './commands/openMain';
import { getTempPath } from './config';
import { rmSync } from 'fs';
import { outputChannel, getOutputChannel } from './utils';
const kernel = new Kernel();

export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(getOutputChannel());
    outputChannel.appendLine('mdlab registering...');
    outputChannel.appendLine('registering commands...');
    context.subscriptions.push(vscode.commands.registerCommand('mdlab.search', searchNotes));
    context.subscriptions.push(vscode.commands.registerCommand('mdlab.openMain', openMain));
    context.subscriptions.push(vscode.commands.registerCommand('mdlab.deleteTemp', () => rmSync(getTempPath(), { recursive: true, force: true })
    ));
    outputChannel.appendLine('finished registering commands');

    const controller = vscode.notebooks.createNotebookController('mdlab', 'mdlab', 'mdlab');
    controller.supportedLanguages = [
        'rust',
        'go',
        'javascript',
        'typescript',
        'shellscript',
        'fish',
        'bash',
        'nushell',
        'zsh',
        'json',
        'plaintext',
        'openai',
        'llama3-8b',
        'python',
        'mojo'
    ];
    controller.executeHandler = (cells, doc, ctrl) => {
        if (cells.length > 1) {
            kernel.executeCells(doc, cells, ctrl);
        } else {
            kernel.executeCell(doc, cells, ctrl);
        }
    };
    const notebookSettings = {
        transientOutputs: false,
        transientCellMetadata: {
            inputCollapsed: true,
            outputCollapsed: true,
        }
    };

    outputChannel.appendLine('registering notebook serializer...');
    context.subscriptions.push(vscode.workspace.registerNotebookSerializer('mdlab', new MarkdownProvider(), notebookSettings));
    outputChannel.appendLine('finished registering notebook serializer');
    outputChannel.appendLine('mdlab ready');
}

class MarkdownProvider implements vscode.NotebookSerializer {
    deserializeNotebook(content: Uint8Array, token: vscode.CancellationToken): vscode.NotebookData | Thenable<vscode.NotebookData> {
        outputChannel.appendLine('deserializing notebook...');
        const contentString = Buffer.from(content)
            .toString('utf8');
        const cellRawData = parseMarkdown(contentString);
        const cells = cellRawData.map(rawToNotebookCellData);
        outputChannel.appendLine('finished deserializing notebook');

        return {
            cells
        };
    }

    serializeNotebook(content: vscode.NotebookData, token: vscode.CancellationToken): Uint8Array | Thenable<Uint8Array> {
        outputChannel.appendLine('serializing notebook...');
        const stringOutput = writeCellsToMarkdown(content.cells);
        outputChannel.appendLine('serialized notebook complete');
        return Buffer.from(stringOutput);
    }
}

export function rawToNotebookCellData(data: RawNotebookCell): vscode.NotebookCellData {
    let langSplit = data.language.split(":")
    // If nothing in split, use the language id
    let lang = langSplit.length > 0 ? langSplit[0].trim() : data.language
    const languageId = LANG_IDS.get(lang) || lang;
    // Empty string if no command otherwise get pos 1 of the split
    let command = langSplit.length > 1 ? langSplit[1] : ""
    return <vscode.NotebookCellData>{
        kind: data.kind,
        languageId,
        metadata: { leadingWhitespace: data.leadingWhitespace, trailingWhitespace: data.trailingWhitespace, indentation: data.indentation, command: command },
        outputs: data.outputs || [],
        value: data.content,
    };
}
