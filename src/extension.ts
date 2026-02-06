import * as vscode from 'vscode';
import { BlockEditorProvider } from './webview/BlockEditorProvider';
import { PythonParserService } from './parser/PythonParserService';
import { registerCommands } from './commands';
import { Logger } from './utils/logger';

let parserService: PythonParserService;

export async function activate(context: vscode.ExtensionContext) {
    Logger.info('VisualPy extension activating...');

    // Initialize the Python parser service
    parserService = new PythonParserService(context);

    // Register the webview provider
    const blockEditorProvider = new BlockEditorProvider(context, parserService);

    // Register commands
    registerCommands(context, blockEditorProvider);

    // Register the custom editor provider for side-by-side view
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'visualpy.blockCanvas',
            blockEditorProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    Logger.info('VisualPy extension activated successfully');
}

export function deactivate() {
    Logger.info('VisualPy extension deactivating...');
    if (parserService) {
        parserService.dispose();
    }
}
