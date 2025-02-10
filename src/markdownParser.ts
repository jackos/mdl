import { TextDecoder, TextEncoder } from 'util';
import { NotebookCellKind, NotebookCellData, window } from 'vscode';

export interface RawNotebookCell {
    indentation?: string;
    leadingWhitespace: string;
    trailingWhitespace: string;
    language: string;
    content: string;
    kind: NotebookCellKind;
    outputs?: [any];
}

interface ICodeBlockStart {
    langId: string;
}

export const LANG_IDS = new Map([
    ['js', 'javascript'],
    ['ts', 'typescript'],
    ['rust', 'rust'],
    ['go', 'go'],
    ['nu', 'nushell'],
    ['sh', 'bash'],
    ['fish', 'fish'],
    ['zsh', 'zsh'],
    ['openai', 'openai'],
    ['llama3-8b', 'llama3-8b'],
]);

const LANG_ABBREVS = new Map(
    Array.from(LANG_IDS.keys()).map(k => [LANG_IDS.get(k), k])
);

function parseCodeBlockStart(line: string): string | null {
    const match = line.match(/(    |\t)?```(.*)/);
    if (match) {
        return match[2];
    }
    return null;
}

function isCodeBlockStart(line: string): boolean {
    return !!parseCodeBlockStart(line);
}

function isCodeBlockEndLine(line: string): boolean {
    return !!line.match(/^\s*```/);
}


export function parseMarkdown(content: string): RawNotebookCell[] {
    const lines = content.split(/\r?\n/g);
    let cells: RawNotebookCell[] = [];

    if (lines.length < 2) {
        return cells;
    }
    let i = 0;

    // Each parse function starts with line i, leaves i on the line after the last line parsed
    while (i < lines.length) {
        const leadingWhitespace = i === 0 ? parseWhitespaceLines(true) : '';
        const lang = parseCodeBlockStart(lines[i]);
        if (lang) {
            parseCodeBlock(leadingWhitespace, lang);
        } else {
            parseMarkdownParagraph(leadingWhitespace);
        }
    }


    function parseWhitespaceLines(isFirst: boolean): string {
        let start = i;
        const nextNonWhitespaceLineOffset = lines.slice(start).findIndex(l => l !== '');
        let end: number; // will be next line or overflow
        let isLast = false;
        if (nextNonWhitespaceLineOffset < 0) {
            end = lines.length;
            isLast = true;
        } else {
            end = start + nextNonWhitespaceLineOffset;
        }
        i = end;
        const numWhitespaceLines = end - start + (isFirst || isLast ? 0 : 1);
        return '\n'.repeat(numWhitespaceLines);
    }

    function parseCodeBlock(leadingWhitespace: string, lang: string): void {
        const startSourceIdx = ++i;
        while (true) {
            const currLine = lines[i];
            if (i >= lines.length) {
                break;
            } else if (isCodeBlockEndLine(currLine)) {
                i++; // consume block end marker
                break;
            }
            i++;
        }
        const textEncoder = new TextEncoder();
        const content = lines.slice(startSourceIdx, i - 1)
            .join('\n');
        const trailingWhitespace = parseWhitespaceLines(false);
        if (lang === "text") {
            cells[cells.length - 1].outputs = [{ items: [{ data: textEncoder.encode(content), mime: "text/plain"}] }];
        } else {
            cells.push({
                language: lang,
                content,
                kind: NotebookCellKind.Code,
                leadingWhitespace: leadingWhitespace,
                trailingWhitespace: trailingWhitespace,
            });
        }
    }

    function parseMarkdownParagraph(leadingWhitespace: string): void {
        const startSourceIdx = i;
        while (true) {
            if (i >= lines.length) {
                break;
            }

            const currLine = lines[i];
            if (isCodeBlockStart(currLine)) {
                break;
            }

            i++;
        }

        let content = lines.slice(startSourceIdx, i).join('\n').trim();
        cells.push({
            language: 'markdown',
            content,
            kind: NotebookCellKind.Markup,
            leadingWhitespace: leadingWhitespace,
            trailingWhitespace: ""
        });
    }

    return cells;
}

const stringDecoder = new TextDecoder();
export function writeCellsToMarkdown(cells: ReadonlyArray<NotebookCellData>): string {
    let result = '';
    for (let i = 0; i < cells.length; i++) {
        result += "\n\n"
        const cell = cells[i];
        if (cell.kind === NotebookCellKind.Code) {
            let outputParsed = "";
            if (cell.outputs) {
                for (const x of cell.outputs) {
                    if (x.items[0].mime.includes("text") && x.items[0].data.length) {
                        outputParsed += stringDecoder.decode(x.items[0].data);
                    }
                }
            }
            const languageAbbrev = LANG_ABBREVS.get(cell.languageId) ?? cell.languageId;
            let codePrefix = '```' + languageAbbrev;
            if (cell.metadata?.command) {
                codePrefix += ` :${cell.metadata.command}\n`;
            } else {
                codePrefix += '\n';
            }
            const contents = cell.value.split(/\r?\n/g)
                .join('\n');
            const codeSuffix = '\n```';
            result += codePrefix + contents + codeSuffix;
            if (outputParsed !== '' && outputParsed !== '\n' && outputParsed.length > 0) {
                result += '\n\n```text\n' + outputParsed;
                if (outputParsed.slice(-1) !== '\n') {
                    result += '\n';
                }
                result += '```';
            }
        } else {
            result += cell.value.trim();
        }
    }
    // Each cell adds a newline at the start to keep spacing between code blocks correct
    return result.substring(2);
}
