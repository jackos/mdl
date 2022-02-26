import { workspace } from 'vscode';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import * as vscode from 'vscode';
import { log } from "./util";

const configuration = () => workspace.getConfiguration('codebook');

export const getBaseFile = () => configuration().get<string>('baseFile') || 'index.md';

export const getBasePath = () => configuration().get<string>('basePath') || join(homedir(), 'codebook');

export const getTempPath = () => configuration().get<string>('tempPath') || join(tmpdir(), 'codebook');
