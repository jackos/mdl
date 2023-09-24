import { commands, Uri, ViewColumn, window, workspace } from 'vscode';
import { getTempPath } from '../config';
import * as path from 'path';
import { lastRunLanguage } from '../kernel';
import { spawnSync } from 'child_process';
import { rename, rmSync } from 'fs';

export const openMain = async () => {
    let dir = getTempPath();
    let main: string;
    switch (lastRunLanguage) {
        case "":
            window.showWarningMessage("No cell has run yet, run a cell before trying to open temp file");
            return;
        case "rust":
            main = path.join(dir, 'src', 'main.rs');
            let mainFormatted = path.join(dir, 'src', 'main-formatted.rs');
            rename(mainFormatted, main, () => { console.log("moved file"); });
            spawnSync('cargo', ['fmt', '--manifest-path', `${dir}/Cargo.toml`]);
            break;
        case "go":
            main = path.join(dir, 'main.go');
            break;
        case "python":
            main = path.join(dir, 'main.py');
            break;
        case "mojo":
            main = path.join(dir, 'main.mojo');
            break;
        case "shell":
            main = path.join(dir, 'main');
            break;
        default:
            window.showErrorMessage("Language not implemented in `src/commands/openMain`, check folder in your explorer");
            return;
    }

    workspace.updateWorkspaceFolders(workspace.workspaceFolders ? workspace.workspaceFolders.length : 0, null, { uri: Uri.parse(dir) });
    workspace.openTextDocument(main).then(doc => {
        window.showTextDocument(doc, ViewColumn.Beside, true);
    });
    if (lastRunLanguage === "rust") {
        commands.executeCommand("rust-analyzer.reload");
    }
};
