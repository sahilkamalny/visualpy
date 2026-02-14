import * as vscode from 'vscode';
import * as path from 'path';
import { PythonParserService } from '../parser/PythonParserService';
import { astToBlocks } from '../mapper/codeToBlocks';
import { blocksToCode } from '../mapper/blocksToCode';
import { Block, Theme, Config, ExtensionMessage, WebviewMessage, SyncStatus } from '../types';
import { Logger } from '../utils/logger';
import { getConfig, debounce } from '../utils';

/**
 * Webview provider for the block editor panel
 */
export class BlockEditorProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'visualpy.blockCanvas';

    private view?: vscode.WebviewView;
    private panel?: vscode.WebviewPanel;
    private context: vscode.ExtensionContext;
    private parserService: PythonParserService;
    private currentDocument?: vscode.TextDocument;
    private blocks: Block[] = [];
    private syncStatus: SyncStatus = 'synced';
    private isUpdatingCode = false;
    private _lastSyncedCode = '';
    private disposables: vscode.Disposable[] = [];

    constructor(
        context: vscode.ExtensionContext,
        parserService: PythonParserService
    ) {
        this.context = context;
        this.parserService = parserService;

        // Listen for active editor changes
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor?.document.languageId === 'python') {
                    this.handleDocumentChange(editor.document);
                }
            })
        );

        // Listen for document changes
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                if (this.currentDocument && event.document === this.currentDocument) {
                    this.handleDocumentEdit(event);
                }
            })
        );

        // Listen for document save
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(document => {
                if (document === this.currentDocument) {
                    this.handleDocumentSave();
                }
            })
        );

        // Listen for configuration changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(event => {
                if (event.affectsConfiguration('visualpy')) {
                    this.sendConfigUpdate();
                }
            })
        );
    }

    /**
     * Required by WebviewViewProvider
     */
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.view = webviewView;
        this.setupWebview(webviewView.webview);
    }

    /**
     * Open the block editor as a panel (side by side with editor)
     */
    async openPanel(): Promise<void> {
        // Get active Python document
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'python') {
            vscode.window.showWarningMessage('Please open a Python file first');
            return;
        }

        this.currentDocument = editor.document;

        // Create or reveal panel
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'visualpy.blockEditor',
                `VisualPy: ${path.basename(editor.document.fileName)}`,
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
                        vscode.Uri.joinPath(this.context.extensionUri, 'webview'),
                        vscode.Uri.joinPath(this.context.extensionUri, 'resources')
                    ]
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null, this.disposables);

            this.setupWebview(this.panel.webview);
        }

        // Parse and send initial blocks
        await this.parseAndSendBlocks();
    }

    /**
     * Set up webview with HTML and message handling
     */
    private setupWebview(webview: vscode.Webview): void {
        webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
                vscode.Uri.joinPath(this.context.extensionUri, 'webview'),
                vscode.Uri.joinPath(this.context.extensionUri, 'resources')
            ]
        };

        webview.html = this.getWebviewContent(webview);

        // Handle messages from webview
        webview.onDidReceiveMessage(
            (message: WebviewMessage) => this.handleWebviewMessage(message),
            null,
            this.disposables
        );
    }

    /**
     * Generate webview HTML content
     */
    private getWebviewContent(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'webview.js')
        );

        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'webview.css')
        );

        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
        );

        const nonce = this.getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>VisualPy Block Editor</title>
</head>
<body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    /**
     * Handle messages from webview
     */
    private async handleWebviewMessage(message: WebviewMessage): Promise<void> {
        // @ts-ignore - Valid at runtime
        Logger.debug(`Webview Message: ${message.type}`, message.payload);

        switch (message.type) {
            case 'READY':
                await this.parseAndSendBlocks();
                break;

            case 'BLOCKS_CHANGED':
                this.blocks = message.payload.blocks;
                this.syncStatus = 'pending';
                // Realtime sync is disabled by default, waiting for manual sync
                if (getConfig().syncMode === 'realtime') {
                    this.syncBlocksToCode();
                }
                break;

            case 'REQUEST_SYNC':
                if (message.payload.blocks) {
                    this.blocks = message.payload.blocks;
                }

                if (message.payload.direction === 'toCode') {
                    Logger.info('Manual Sync to Code requested');
                    await this.syncBlocksToCode();
                } else {
                    Logger.info('Manual Refresh from Code requested');
                    await this.parseAndSendBlocks();
                }
                break;

            case 'BLOCK_SELECTED':
                if (this.currentDocument && message.payload.sourceRange) {
                    // ... selection logic ...
                }
                break;

            case 'LOG':
                const level = message.payload.level;
                if (level === 'error') Logger.error(message.payload.message);
                else if (level === 'warn') Logger.warn(message.payload.message);
                else Logger.info(`[Webview] ${message.payload.message}`);
                break;

            case 'ERROR':
                Logger.error(`Webview error: ${message.payload.message}`);
                vscode.window.showErrorMessage(`VisualPy: ${message.payload.message}`);
                break;
        }
    }

    /**
     * Parse current document and send blocks to webview
     */
    async parseAndSendBlocks(): Promise<void> {
        if (!this.currentDocument) {
            return;
        }

        try {
            const source = this.currentDocument.getText();
            const parseResult = await this.parserService.parse(source);

            if (!parseResult.success) {
                const error = parseResult.errors[0];
                Logger.warn('Parse failed, sending error toast', error);
                this.sendMessage({
                    type: 'PARSE_ERROR',
                    payload: {
                        message: error.message || 'Syntax error',
                        line: error.lineno || undefined
                    }
                });
                return;
            }

            this.blocks = astToBlocks(parseResult);

            // Add hash to new blocks
            // this.assignBlockHashes(this.blocks);
            Logger.info('Sending blocks to webview', { count: this.blocks.length });

            this.sendMessage({
                type: 'INIT',
                payload: {
                    blocks: this.blocks,
                    theme: this.getTheme(),
                    config: getConfig(),
                    fileName: path.basename(this.currentDocument.fileName)
                }
            });

            this.syncStatus = 'synced';
            this.sendMessage({
                type: 'SYNC_STATUS',
                payload: { status: 'synced' }
            });
        } catch (error: any) {
            Logger.error('Failed to parse blocks', error);
            // Send error to webview so it can show a toast and KEEP existing blocks
            this.sendMessage({
                type: 'PARSE_ERROR',
                payload: {
                    message: error.message || 'Syntax error in Python code',
                    line: error.lineNumber
                }
            });
        }
    }

    /**
     * Sync blocks back to code
     */
    async syncBlocksToCode(): Promise<void> {
        if (!this.currentDocument || this.isUpdatingCode) {
            if (this.isUpdatingCode) Logger.warn('Sync skipped: Already updating code');
            return;
        }

        this.isUpdatingCode = true;
        Logger.info('Syncing blocks to code...');

        try {
            const code = blocksToCode(this.blocks);
            this._lastSyncedCode = code;
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                this.currentDocument.positionAt(0),
                this.currentDocument.positionAt(this.currentDocument.getText().length)
            );

            edit.replace(this.currentDocument.uri, fullRange, code);

            const success = await vscode.workspace.applyEdit(edit);

            if (success) {
                Logger.info('Code sync successful');
                this.syncStatus = 'synced';
                this.sendMessage({
                    type: 'SYNC_STATUS',
                    payload: { status: 'synced' }
                });

                // Re-parse to capture implicit changes (e.g. `pass` inserted by blocksToCode)
                // and send updated blocks. The webview's reconcileBlocks logic prevents flicker.
                await this.parseAndSendBlocks();
                // Update hash after re-parse (parseAndSendBlocks doesn't change the document)
                this._lastSyncedCode = this.currentDocument.getText();
            } else {
                Logger.error('Code sync failed: applyEdit returned false');
                this.syncStatus = 'error';
                this.sendMessage({
                    type: 'SYNC_STATUS',
                    payload: { status: 'error', message: 'Sync failed' }
                });
            }
        } catch (error) {
            Logger.error('Failed to sync blocks to code', error);
            this.syncStatus = 'error';
            this.sendMessage({
                type: 'SYNC_STATUS',
                payload: { status: 'error', message: 'Sync failed' }
            });
        } finally {
            setTimeout(() => {
                this.isUpdatingCode = false;
            }, 50); // Reduced from 500ms to 50ms to catch user edits faster
        }
    }

    /**
     * Handle document change (file switch)
     */
    private handleDocumentChange(document: vscode.TextDocument): void {
        if (document !== this.currentDocument) {
            this.currentDocument = document;
            if (this.panel || this.view) {
                this.parseAndSendBlocks();
                if (this.panel) {
                    this.panel.title = `VisualPy: ${path.basename(document.fileName)}`;
                }
            }
        }
    }

    /**
     * Handle document edits
     */
    private handleDocumentEdit = debounce((event: vscode.TextDocumentChangeEvent) => {
        // If we are currently updating the code ourselves, ignore this event.
        if (this.isUpdatingCode) return;

        // Use content hash to determine if this is our own edit or an external one.
        // This is more robust than flag-based approaches that can swallow external edits.
        if (this.currentDocument) {
            const currentNorm = this.currentDocument.getText().replace(/\r\n/g, '\n');
            const syncedNorm = this._lastSyncedCode.replace(/\r\n/g, '\n');
            if (currentNorm === syncedNorm) {
                return; // Our own edit, skip
            }
        }

        Logger.debug('Document edited externally');

        // Re-parse: user edited the Python file externally
        this.parseAndSendBlocks();
    }, 100); // Reduced from 200ms to 100ms for snappier updates

    /**
     * Handle document save
     */
    private handleDocumentSave(): void {
        const config = getConfig();
        if (config.syncMode === 'onSave') {
            this.parseAndSendBlocks();
        }
    }

    /**
     * Send config update to webview
     */
    private sendConfigUpdate(): void {
        this.sendMessage({
            type: 'CONFIG_CHANGED',
            payload: { config: getConfig() }
        });
    }

    /**
     * Send message to webview
     */
    private sendMessage(message: ExtensionMessage): void {
        const webview = this.panel?.webview || this.view?.webview;
        if (webview) {
            webview.postMessage(message);
        }
    }

    /**
     * Get current theme
     */
    private getTheme(): Theme {
        const kind = vscode.window.activeColorTheme.kind;
        if (kind === vscode.ColorThemeKind.Light) {
            return 'light';
        } else if (kind === vscode.ColorThemeKind.HighContrast || kind === vscode.ColorThemeKind.HighContrastLight) {
            return 'high-contrast';
        }
        return 'dark';
    }

    /**
     * Generate nonce for CSP
     */
    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.panel?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
