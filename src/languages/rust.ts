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
	let cell_count = 0;
	let ignored_cell = 0;
	let tokio = false;
	let mainFunc = "";
	let cargo = "";

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
				ignored_cell = cell_count;
				break;
			}

			if (line === "[package]") {
				cargo = cell.contents;
				break;
			}

			i++;
			if (line.startsWith("#[restart]")) {
				innerScope = `\nprintln!("!!output-start-cell");\n`.repeat(cell_count);
				mainFunc = "";
				continue;
			}

			if (line.startsWith("#[tokio::main")) {
				mainFunc += line;
				tokio = true;
				continue;
			}

			if (line.startsWith("async fn main()")) {
				mainFunc += "\n" + line;
				continue;
			}

			if (line.startsWith("fn main()")) {
				mainFunc = line;
				continue;
			}

			if (cargo === "") {
				if (line.startsWith("use")) {
					outerScope += line;
					outerScope += "\n";
					if (!line.startsWith("use std")) {
						let match = line.match(/use (\w+)/);
						if (match) {
							let crate = match[1];
							let alreadyFound = crates.split("\n");
							let latestVersion = '="*"';
							if (crate == "tokio") {
								tokio = true;
							} else {
								if (alreadyFound.indexOf(crate + latestVersion) < 0) {
									crates += crate + latestVersion + "\n";
								}
							}
						}
					}
				} else {
					if (i == len) {
						// If last item is an expression, debug it
						if (line.length > 0 && line[line.length - 1] !== ";" && line[line.length - 1] !== "}") {
							// if first char is `#` pretty print
							if (line[0] === "#") {
								line = "dbg_codebook_pretty!(&" + line.substring(1) + ");";
							} else {
								line = "dbg_codebook!(&" + line + ");"
							}
						}

					}
					innerScope += line;
					innerScope += "\n";
					console.log(innerScope)
				}
			}
		}

		if (mainFunc.length > 0) {
			innerScope = innerScope.trimEnd();
			innerScope = innerScope.slice(0, -1);
			// if (i != cells.length) {
			// mainFunc = "";
			// }
		}
		mainFunc = "";
	}
	if (cell_count == ignored_cell) {
		mainFunc = "";
		innerScope = `\nprintln!("!!output-start-cell");\n`.repeat(cell_count);
	}
	if (mainFunc.length == 0) {
		mainFunc = "fn main() -> Result<(), Box<dyn std::error::Error>> {\n"
	}
	if (tokio) {
		crates += `tokio = { vesrion = "*", features = ["full"] }\n`
	}

	let main = prelude + outerScope + mainFunc + innerScope + "Ok(())\n}";

	let mainFormatted = outerScope + mainFunc + innerScope + "Ok(())\n}";
	mainFormatted = mainFormatted.replace(/\nprintln!\("!!output-start-cell"\);\n/g, "\n");
	if (cargo === "") {
		cargo = '[package]\nname = "output"\nversion = "0.0.1"\nedition="2021"\n[dependencies]\n' + crates
	}

	mkdirSync(`${tempDir}/rust/src`, { recursive: true });
	writeFileSync(`${tempDir}/rust/src/main.rs`, main);
	writeFileSync(`${tempDir}/rust/src/main-formatted.rs`, mainFormatted);
	writeFileSync(`${tempDir}/rust/Cargo.toml`, cargo);
	return spawn('cargo', ['run', '--all-features', '--manifest-path', `${tempDir}/rust/Cargo.toml`]);
};
