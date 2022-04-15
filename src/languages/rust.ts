import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { getTempPath } from "../config";
import { Cell } from "../kernel";
import { prelude } from "./rust_prelude";


let tempDir = getTempPath();

export const processCellsRust = (cells: Cell[]): ChildProcessWithoutNullStreams => {
	let crates = "";
	let outerScope = "";
	let innerScope = "";
	let mainFunc = "fn main() {\n";
	let containsMain = false;
	let cell_count = 0;

	for (let cell of cells) {
		// Remove newlines to avoid logic conflicts
		cell.contents = cell.contents.trim()
		cell_count++;
		innerScope += `\nprintln!("!!output-start-cell");\n`;
		let lines = cell.contents.split("\n");
		const len = lines.length;
		let i = 0;
		for (let line of lines) {
			line = line.trim();
			if (line.startsWith("#[ignore]")) {
				break;
			}
			i++;

			if (line.startsWith("#[restart]")) {
				innerScope = `\nprintln!("!!output-start-cell");\n`.repeat(cell_count);
				crates = "";
				outerScope = "";
				containsMain = false;
				continue;
			}

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
				if (i == len) {
					// If last item is an expression, debug it
					if (line[line.length - 1] !== ";" && line[line.length - 1] !== "}") {
						// if first char is `#` pretty print
						if (line[0] === "#") {
							line = "dbg_pretty!(&" + line.substring(1) + ");";
						} else {
							line = "dbg!(&" + line + ");"
						}
					}
				}
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
	let main = prelude + outerScope + mainFunc + innerScope + "}";
	let mainFormatted = (outerScope + mainFunc + innerScope + "}")
	mainFormatted = mainFormatted.replace(/\nprintln!\("!!output-start-cell"\);\n/g, "\n");
	let cargo = '[package]\nname = "output"\nversion = "0.0.1"\nedition="2021"\n[dependencies]\n' + crates;

	mkdirSync(`${tempDir}/rust/src`, { recursive: true });
	writeFileSync(`${tempDir}/rust/src/main.rs`, main);
	writeFileSync(`${tempDir}/rust/src/main-formatted.rs`, mainFormatted);
	writeFileSync(`${tempDir}/rust/Cargo.toml`, cargo);
	return spawn('cargo', ['run', '--manifest-path', `${tempDir}/rust/Cargo.toml`]);
};
