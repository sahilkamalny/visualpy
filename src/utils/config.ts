import * as vscode from 'vscode';
import { Config } from '../types';

/**
 * Get extension configuration
 */
export function getConfig(): Config {
    const config = vscode.workspace.getConfiguration('visualpy');

    return {
        syncMode: config.get<'manual' | 'onSave' | 'realtime'>('syncMode', 'onSave'),
        indentSize: config.get<number>('indentSize', 4),
        indentStyle: config.get<'spaces' | 'tabs'>('indentStyle', 'spaces'),
        defaultZoom: config.get<number>('defaultZoom', 100),
        showMinimap: config.get<boolean>('showMinimap', true),
        palettePosition: config.get<'left' | 'right' | 'hidden'>('palettePosition', 'left')
    };
}

/**
 * Get Python executable path from settings or auto-detect
 */
export async function getPythonPath(): Promise<string> {
    const config = vscode.workspace.getConfiguration('visualpy');
    const configuredPath = config.get<string>('pythonPath', '');

    if (configuredPath) {
        return configuredPath;
    }

    // Try to get from Python extension
    const pythonExtension = vscode.extensions.getExtension('ms-python.python');
    if (pythonExtension) {
        if (!pythonExtension.isActive) {
            await pythonExtension.activate();
        }
        const pythonApi = pythonExtension.exports;
        if (pythonApi?.settings?.getExecutionDetails) {
            const details = pythonApi.settings.getExecutionDetails(
                vscode.workspace.workspaceFolders?.[0]?.uri
            );
            if (details?.execCommand?.[0]) {
                return details.execCommand[0];
            }
        }
    }

    // Fallback to 'python' or 'python3'
    return process.platform === 'win32' ? 'python' : 'python3';
}


