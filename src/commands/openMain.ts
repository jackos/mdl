import { commands, Uri, ViewColumn, window, workspace } from 'vscode';
import { getTempPath } from '../config';
import path, { sep } from 'path';
import { lastRunLanguage } from '../kernel';

export const openMain = async () => {
	let tempDir = getTempPath();
	let main: string;
	let dir = path.join(tempDir, lastRunLanguage);
	switch (lastRunLanguage) {
		case "":
			window.showWarningMessage("No cell has run yet, run a cell before trying to open temp file");
			return;
		case "rust":
			main = path.join(dir, 'src', 'main.rs');
			break;
		case "go":
			dir = path.join(tempDir, 'go');
			main = path.join(dir, 'main.go');
			break;
		default:
			window.showErrorMessage("Language not implemented in `src/commands/openMain` please open Github issue");
			return;
	}

	workspace.updateWorkspaceFolders(workspace.workspaceFolders ? workspace.workspaceFolders.length : 0, null, { uri: Uri.parse(dir) });
	commands.executeCommand("vscode.open");
	workspace.openTextDocument(main).then(doc => {
		window.showTextDocument(doc, ViewColumn.Beside, true);
	});

	if (lastRunLanguage === "rust") {
		commands.executeCommand("rust-analyzer.reload");
	}
};
