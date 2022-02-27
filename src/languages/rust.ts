import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { getTempPath } from "../config";
import { Cell } from "../kernel";

let tempDir = getTempPath();

// Rust doesn't allow piping stderr to stdout without external crates, we want stderr
// output because it contains `dbg!` info, but we don't want certain useless text on 
// success. On failure this text will remain in the output
export const stripErrors = (errorText: string): string => {
	let compiling = /\s*Compiling .*\n/
	let finished = /\s*Finished .*\n/
	let running = /\s*Running .*\n/
	return errorText.replace(compiling, "").replace(finished, "").replace(running, "").trim();
}

export const processCellsRust = (cells: Cell[]): ChildProcessWithoutNullStreams => {
	let crates = "";
	let outerScope = "";
	let innerScope = "";
	let mainFunc = "fn main() {\n";
	let containsMain = false;

	for (const cell of cells) {
		innerScope += `\nprintln!("!!output-start-cell");\n`;
		let lines = cell.contents.split("\n");
		for (let line of lines) {
			line = line.trim();
			if (line.startsWith("fn main()")) {
				containsMain = true;
				mainFunc = line;
				continue;
			}

			if (line.startsWith("use")) {
				outerScope += line;
				outerScope += "\n";
				if (!line.startsWith("use std")) {
					let match = line.match(/use (\w+)/);
					if (match) {
						let crate = match[1];
						let alreadyFound = crates.split("\n");
						let latestVersion = '="*"';

						if (alreadyFound.indexOf(crate + latestVersion) < 0) {
							crates += crate + latestVersion + "\n";
						}
					}
				}
			} else {
				innerScope += line;
				innerScope += "\n";
			}
		}
		if (containsMain) {
			innerScope = innerScope.trimEnd();
			innerScope = innerScope.slice(0, -1);
			containsMain = false;
		}
	}
	let main = "#![allow(dead_code)]\n" + outerScope + mainFunc + innerScope + "}";
	let cargo = '[package]\nname = "output"\nversion = "0.0.1"\nedition="2021"\n[dependencies]\n' + crates;

	mkdirSync(`${tempDir}/rust/src`, { recursive: true });
	writeFileSync(`${tempDir}/rust/src/main.rs`, main);
	writeFileSync(`${tempDir}/rust/Cargo.toml`, cargo);

	return spawn('cargo', ['run', '--manifest-path', `${tempDir}/rust/Cargo.toml`]);
};
