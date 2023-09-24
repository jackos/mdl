import { workspace } from 'vscode';
import { homedir, tmpdir } from 'os';
import { join } from 'path';

const configuration = () => workspace.getConfiguration('md-notebook');

export const getBaseFile = () => configuration().get<string>('baseFile') || 'index.md';
export const getBasePath = () => configuration().get<string>('basePath') || join(homedir(), 'md-notebook');
export const getTempPath = () => configuration().get<string>('tempPath') || join(tmpdir(), 'md-notebook');
export const getOpenAIOrgID = () => configuration().get<string>('openaiOrgID');
export const getOpenAIModel = () => configuration().get<string>('openaiModel');
export const getOpenAIKey = () => configuration().get<string>('openaiKey');
