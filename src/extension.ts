import { parseMarkdown, writeCellsToMarkdown, RawNotebookCell, LANG_IDS } from './markdownParser';
import { searchNotes } from './commands/search';
import { Kernel } from './kernel';
import {
    notebooks, commands, workspace, ExtensionContext,
    CancellationToken, NotebookSerializer, NotebookData, NotebookCellData
} from 'vscode';
import { openMain } from './commands/openMain';
import { getTempPath } from './config';
import { rmSync } from 'fs';

const kernel = new Kernel();
export async function activate(context: ExtensionContext) {
    const controller = notebooks.createNotebookController('mdlab', 'mdlab', 'mdlab');
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
    context.subscriptions.push(commands.registerCommand('mdlab.search', searchNotes));
    context.subscriptions.push(commands.registerCommand('mdlab.openMain', openMain));
    context.subscriptions.push(commands.registerCommand('mdlab.deleteTemp', () => rmSync(getTempPath(), { recursive: true, force: true })
    ));

    const notebookSettings = {
        transientOutputs: false,
        transientCellMetadata: {
            inputCollapsed: true,
            outputCollapsed: true,
        }
    };

    context.subscriptions.push(workspace.registerNotebookSerializer('mdlab', new MarkdownProvider(), notebookSettings));
}

class MarkdownProvider implements NotebookSerializer {
    deserializeNotebook(data: Uint8Array, _token: CancellationToken): NotebookData | Thenable<NotebookData> {
        const content = Buffer.from(data)
            .toString('utf8');
        const cellRawData = parseMarkdown(content);
        const cells = cellRawData.map(rawToNotebookCellData);

        return {
            cells
        };
    }

    serializeNotebook(data: NotebookData, _token: CancellationToken): Uint8Array | Thenable<Uint8Array> {
        const stringOutput = writeCellsToMarkdown(data.cells);
        return Buffer.from(stringOutput);
    }
}

export function rawToNotebookCellData(data: RawNotebookCell): NotebookCellData {
    let langSplit = data.language.split(":")
    // If nothing in split, use the language id
    let lang = langSplit.length > 0 ? langSplit[0].trim() : data.language
    const languageId = LANG_IDS.get(lang) || lang;
    // Empty string if no command otherwise get pos 1 of the split
    let command = langSplit.length > 1 ? langSplit[1] : ""
    return <NotebookCellData>{
        kind: data.kind,
        languageId,
        metadata: { leadingWhitespace: data.leadingWhitespace, trailingWhitespace: data.trailingWhitespace, indentation: data.indentation, command: command },
        outputs: data.outputs || [],
        value: data.content,
    };
}
