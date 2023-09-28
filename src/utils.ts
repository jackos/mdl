import { execSync } from "child_process";
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
    }
    return true;
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
        vscode.window.showInformationMessage(`Response from openai: ${JSON.stringify(json, null, 2)}`);
        return json as ChatResponse;
        // Proceed with the `result` if needed
    } catch (error) {
        vscode.window.showErrorMessage("Error with fetch request:" + error.toString());
        return {} as ChatResponse;
    }
}
