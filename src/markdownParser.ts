import { TextDecoder, TextEncoder } from 'util';
import { NotebookCellKind, NotebookCellData } from 'vscode';

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

const LANG_IDS = new Map([
	['bat', 'batch'],
	['js', 'javascript'],
	['ts', 'typescript'],
	['rust', 'rust'],
]);

const LANG_ABBREVS = new Map(
	Array.from(LANG_IDS.keys()).map(k => [LANG_IDS.get(k), k])
);

function parseCodeBlockStart(line: string): string | null {
	const match = line.match(/(    |\t)?```(\S*)/);
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
		const language = LANG_IDS.get(lang) || lang;
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
		if (lang === "output") {
			cells[cells.length - 1].outputs = [{ items: [{ data: textEncoder.encode(content), mime: "text/plain" }] }];
		} else {
			cells.push({
				language,
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

		const content = lines.slice(startSourceIdx, i).join('\n');
		const trailingWhitespace = parseWhitespaceLines(false);
		cells.push({
			language: 'markdown',
			content,
			kind: NotebookCellKind.Markup,
			leadingWhitespace: leadingWhitespace,
			trailingWhitespace: trailingWhitespace
		});
	}

	return cells;
}

const stringDecoder = new TextDecoder();
export function writeCellsToMarkdown(cells: ReadonlyArray<NotebookCellData>): string {
	// Always start markdown block with a newline
	let result = '';
	for (let i = 0; i < cells.length; i++) {
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
			const codePrefix = '```' + languageAbbrev + '\n';
			const contents = cell.value.split(/\r?\n/g)
				.join('\n');
			const codeSuffix = '\n' + '```';
			result += codePrefix + contents + codeSuffix;
			if (outputParsed !== '' && outputParsed !== '\n' && outputParsed.length > 0) {
				result += '\n```output\n' + outputParsed;
				if (outputParsed.slice(-1) !== '\n') {
					result += '\n';
				}
				result += '```';
			}
		} else {
			// Puts in a full \n\n above every markdown cell in source code, which is
			// interpreted in markdown as a single \n 
			result += '\n' + cell.value;
		}
		result += '\n';
	}
	return result;
}
