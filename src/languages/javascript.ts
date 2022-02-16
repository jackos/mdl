
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { getTempPath } from "../config";
import { Cell } from "../kernel";

let tempDir = getTempPath();

export let processCellsJavascript = (cells: Cell[]): ChildProcessWithoutNullStreams => {
	let innerScope = "";

	for (const cell of cells) {
		innerScope += `\nconsole.log("!!output-start-cell");\n`;
		let lines = cell.contents.split("\n");
		for (let line of lines) {
			line = line.trim();
			innerScope += line;
			innerScope += "\n";
		}
	};

	let mainFile = `${tempDir}/javascript/main.js`;
	mkdirSync(`${tempDir}/javascript/src`, { recursive: true });
	writeFileSync(`${tempDir}/javascript/main.js`, innerScope);

	return spawn('node', [mainFile]);
};
