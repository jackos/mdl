import { parseMarkdown, writeCellsToMarkdown, RawNotebookCell } from './markdownParser';
import { searchNotes } from './commands/search';
import { Kernel } from './kernel';
import {
  window, notebooks, commands, workspace, ExtensionContext,
  CancellationToken, NotebookSerializer, NotebookData, NotebookCellData
} from 'vscode';
import { openMain } from './commands/openMain';

const kernel = new Kernel();
export async function activate(context: ExtensionContext) {
  const controller = notebooks.createNotebookController('codebook', 'codebook', 'Codebook');

  controller.supportedLanguages = ['rust', 'go', 'javascript', 'typescript', 'nushell'];
  controller.executeHandler = (cells, doc, ctrl) => {
    if (cells.length > 1) {
      kernel.executeCells(doc, cells, ctrl);
    } else {
      kernel.executeCell(doc, cells, ctrl);
    }
  };
  context.subscriptions.push(commands.registerCommand('codebook.kernel.restart', () => {
    window.showInformationMessage('Restarting kernel');
  }));
  context.subscriptions.push(commands.registerCommand('codebook.search', searchNotes));
  context.subscriptions.push(commands.registerCommand('codebook.openMain', openMain));


  const notebookSettings = {
    transientOutputs: false,
    transientCellMetadata: {
      inputCollapsed: true,
      outputCollapsed: true,
    }
  };

  context.subscriptions.push(workspace.registerNotebookSerializer('codebook', new MarkdownProvider(), notebookSettings));
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
