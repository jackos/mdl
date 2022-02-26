import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { getTempPath } from "../config";
import { Cell } from "../kernel";

let tempDir = getTempPath();

export const processCellsNushell = (cells: Cell[]): ChildProcessWithoutNullStreams => {
	let main = "";
	for (const cell of cells) {
		main += `\necho '!!output-start-cell'\n`
		main += cell.contents;
	}

	mkdirSync(`${tempDir}/nu`, { recursive: true });
	writeFileSync(`${tempDir}/nu/main.nu`, main);

	return spawn('nu', [`${tempDir}/nu/main.nu`]);
};

