import * as vscode from 'vscode';
import { BlockEditorProvider } from '../webview/BlockEditorProvider';
import { Logger } from '../utils/logger';

/**
 * Register all extension commands
 */
export function registerCommands(
    context: vscode.ExtensionContext,
    blockEditorProvider: BlockEditorProvider
): void {
    // Open Block Editor command
    context.subscriptions.push(
        vscode.commands.registerCommand('visualpy.openBlockEditor', async () => {
            try {
                await blockEditorProvider.openPanel();
            } catch (error) {
                Logger.error('Failed to open block editor', error);
                vscode.window.showErrorMessage('Failed to open VisualPy block editor');
            }
        })
    );

    // Sync Code to Blocks command
    context.subscriptions.push(
        vscode.commands.registerCommand('visualpy.syncCodeToBlocks', async () => {
            try {
                // This will trigger a re-parse
                await blockEditorProvider.openPanel();
            } catch (error) {
                Logger.error('Failed to sync code to blocks', error);
                vscode.window.showErrorMessage('Failed to sync code to blocks');
            }
        })
    );

    // Sync Blocks to Code command
    context.subscriptions.push(
        vscode.commands.registerCommand('visualpy.syncBlocksToCode', async () => {
            try {
                // The webview will send a message to sync
                vscode.window.showInformationMessage('Use the Sync button in the block editor');
            } catch (error) {
                Logger.error('Failed to sync blocks to code', error);
                vscode.window.showErrorMessage('Failed to sync blocks to code');
            }
        })
    );

    Logger.info('Commands registered');
}
