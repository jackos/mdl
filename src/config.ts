import { workspace } from 'vscode';
import { homedir, tmpdir } from 'os';
import { join } from 'path';

const config = () => workspace.getConfiguration('mdlab');
const mojoConfig = () => workspace.getConfiguration('mojo');

export const getBaseFile = () => config().get<string>('baseFile') || 'index.md';
export const getBasePath = () => config().get<string>('basePath') || join(homedir(), 'mdlab');
export const getTempPath = () => config().get<string>('tempPath') || join(tmpdir(), 'mdlab');
export const getOpenAIOrgID = () => config().get<string>('openaiOrgID');
export const getOpenAIModel = () => config().get<string>('openaiModel');
export const getOpenAIKey = () => config().get<string>('openaiKey');
export const getGroqAIKey = () => config().get<string>('groqKey');
export const modularHome = () => mojoConfig().get<string | undefined>('modularHomePath')