
import { ChildProcessWithoutNullStreams, spawn, spawnSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { getTempPath } from "../config";
import { Cell } from "../kernel";

let tempDir = getTempPath();

export let processCellsTypescript = (cells: Cell[]): ChildProcessWithoutNullStreams => {
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

	let mainFile = `${tempDir}/typescript/main`;
	mkdirSync(`${tempDir}/typescript`, { recursive: true });
	writeFileSync(mainFile + ".ts", innerScope);
	// spawnSync('tsc', [mainFile + ".ts"]);

	return spawn('ts-node', [mainFile + ".ts"]);
};
