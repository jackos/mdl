import { ChildProcessWithoutNullStreams, execSync, spawn } from "child_process";
import vscode from "vscode"
import { ChatResponse } from "./types";

export const commandNotOnPath = (command: string, link: string): boolean => {
  try {
    // Use the "where" command on Windows or the "which" command on macOS/Linux
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execSync(`${cmd} ${command}`, { stdio: 'ignore' });
    return false;
  } catch (error) {
    if(link) {
        vscode.window.showErrorMessage(`command: ${command} not on path. Add to path or follow link to install`, ...[`Install ${command}`]).then((_)=>{
            vscode.env.openExternal(vscode.Uri.parse(link));
        });
        return true;
    }
    return false;
  }
}


export const post = async (url, headers, body): Promise<ChatResponse> => {
    try {
        let response = await fetch(url, { headers, body, method: 'POST' });

        // Check if status code starts with 2
        if (response.status >= 300) {
            vscode.window.showErrorMessage(`Error getting response: ${response.status}\n${await response.text()}`);
            return {} as ChatResponse;
        }

        let json = await response.json()
        vscode.window.showInformationMessage(`Response from LLM: ${JSON.stringify(json, null, 2)}`);
        return json as ChatResponse;
        // Proceed with the `result` if needed
    } catch (error) {
        vscode.window.showErrorMessage("Error with fetch request:" + error.toString());
        return {} as ChatResponse;
    }
}


/**
 * Runs a shell command using spawn and returns a promise that resolves with the command output.
 */
function runCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn(command, { shell: true });
    let output = '';

    child.stdout.on('data', (data: Uint8Array) => {
      output += data.toString();
    });
    child.stderr.on('data', (data: Uint8Array) => {
      output += data.toString();
    });
    child.on('error', (err: Error) => {
      reject(err);
    });
    child.on('close', (code: number) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command "${command}" exited with code ${code}`));
      }
    });
  });
}

export async function installMojo(): Promise<void> {
  try {
    vscode.window.showInformationMessage("Installing Magic, the Mojo package manager...");
    await runCommand("curl -ssL https://magic.modular.com | bash");

    vscode.window.showInformationMessage("Installing Mojo...");
    await runCommand("magic global install max");

    vscode.window.showInformationMessage("Exposing Mojo globally...");
    // Note the proper escaping for the inner command
    await runCommand(`magic global expose add -e max $(find "$HOME/.modular/envs/max/bin" -type f -exec basename {} \\;)`);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Error during Mojo installation: ${err.message}`);
  }
}