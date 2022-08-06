import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { mkdirSync, writeFileSync, chmodSync } from "fs";
import { getTempPath } from "../config";
import { Cell, lastRunLanguage } from "../kernel";

let tempDir = getTempPath();

export const processShell = (cells: Cell[], language: string): ChildProcessWithoutNullStreams => {
	let main = "";
	for (const cell of cells) {
		main += `#!/bin/${language}\necho '!!output-start-cell'\n`
		main += cell.contents;
	}

	let extension = "sh";
	let runCommand = "bash"
	switch(language) {
		case "nushell":
			extension = "nu";
			break
		case "fish":
			extension = "fish"
	}

	const pathName = `${tempDir}/shell`
	const filename = `${pathName}/main.${extension}`
	mkdirSync(pathName, { recursive: true });
	writeFileSync(filename, main);
	chmodSync(filename, 0o755);

	return spawn(extension, [`${filename}`]);
	// return spawn('cargo', ['run', '--manifest-path', `${tempDir}/rust/Cargo.toml`]);
};

