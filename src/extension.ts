import { parseMarkdown, writeCellsToMarkdown, RawNotebookCell } from './markdownParser';
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
    const controller = notebooks.createNotebookController('md-notebook', 'md-notebook', 'md-notebook');
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
    context.subscriptions.push(commands.registerCommand('md-notebook.search', searchNotes));
    context.subscriptions.push(commands.registerCommand('md-notebook.openMain', openMain));
    context.subscriptions.push(commands.registerCommand('md-notebook.deleteTemp', () => rmSync(getTempPath(), { recursive: true, force: true })
));

    const notebookSettings = {
        transientOutputs: false,
        transientCellMetadata: {
            inputCollapsed: true,
            outputCollapsed: true,
        }
    };

    context.subscriptions.push(workspace.registerNotebookSerializer('md-notebook', new MarkdownProvider(), notebookSettings));
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
    return <NotebookCellData>{
        kind: data.kind,
        languageId: data.language,
        metadata: { leadingWhitespace: data.leadingWhitespace, trailingWhitespace: data.trailingWhitespace, indentation: data.indentation },
        outputs: data.outputs || [],
        value: data.content,
    };
}
