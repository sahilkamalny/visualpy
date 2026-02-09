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
            vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist', 'webview.js')
        );

        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist', 'webview.css')
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
    <style>
        :root {
            --vp-bg-primary: var(--vscode-editor-background);
            --vp-bg-secondary: var(--vscode-sideBar-background);
            --vp-text-primary: var(--vscode-editor-foreground);
            --vp-text-secondary: var(--vscode-descriptionForeground);
            --vp-border: var(--vscode-editorWidget-border);
            --vp-focus: var(--vscode-focusBorder);
            --vp-block-radius: 8px;
            --vp-block-padding: 8px 16px;
            --vp-nesting-indent: 24px;
        }
        
        * {
            box-sizing: border-box;
        }
        
        body {
            margin: 0;
            padding: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background: var(--vp-bg-primary);
            color: var(--vp-text-primary);
            overflow: hidden;
        }
        
        #app {
            display: flex;
            flex-direction: column;
            height: 100vh;
            width: 100vw;
        }
        
        .toolbar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: var(--vp-bg-secondary);
            border-bottom: 1px solid var(--vp-border);
            flex-shrink: 0;
        }
        
        .toolbar-button {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: transparent;
            border: 1px solid var(--vp-border);
            border-radius: 4px;
            color: var(--vp-text-primary);
            cursor: pointer;
            font-size: 12px;
        }
        
        .toolbar-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .toolbar-button.primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
        }
        
        .toolbar-button.primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .toolbar-spacer {
            flex: 1;
        }
        
        .toolbar-title {
            font-weight: 500;
            color: var(--vp-text-secondary);
        }
        
        .sync-indicator {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
        }
        
        .sync-indicator.synced {
            background: rgba(16, 185, 129, 0.2);
            color: #10B981;
        }
        
        .sync-indicator.pending {
            background: rgba(245, 158, 11, 0.2);
            color: #F59E0B;
        }
        
        .sync-indicator.error {
            background: rgba(239, 68, 68, 0.2);
            color: #EF4444;
        }
        
        .main-container {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        
        .palette {
            width: 220px;
            background: var(--vp-bg-secondary);
            border-right: 1px solid var(--vp-border);
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }
        
        .palette-search {
            padding: 8px;
            border-bottom: 1px solid var(--vp-border);
        }
        
        .palette-search input {
            width: 100%;
            padding: 6px 10px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            color: var(--vscode-input-foreground);
            font-size: 12px;
        }
        
        .palette-search input:focus {
            outline: none;
            border-color: var(--vp-focus);
        }
        
        .palette-content {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
        }
        
        .palette-category {
            margin-bottom: 12px;
        }
        
        .palette-category-header {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 0;
            cursor: pointer;
            font-size: 11px;
            text-transform: uppercase;
            color: var(--vp-text-secondary);
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        
        .palette-category-header:hover {
            color: var(--vp-text-primary);
        }
        
        .palette-items {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-top: 4px;
        }
        
        .palette-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            border-radius: 6px;
            cursor: grab;
            font-size: 12px;
            transition: transform 0.1s, box-shadow 0.1s;
        }
        
        .palette-item:hover {
            transform: translateX(2px);
        }
        
        .palette-item:active {
            cursor: grabbing;
        }
        
        .palette-item-icon {
            font-size: 14px;
        }
        
        .canvas-container {
            flex: 1;
            overflow: auto;
            padding: 20px;
        }
        
        .canvas {
            min-height: 100%;
            position: relative;
        }
        
        .block {
            display: flex;
            flex-direction: column;
            margin: 4px 0;
            border-radius: var(--vp-block-radius);
            background: var(--block-color, #6B7280);
            color: white;
            transition: transform 0.1s, box-shadow 0.15s;
            cursor: pointer;
            position: relative;
        }
        
        .block:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .block.selected {
            box-shadow: 0 0 0 2px var(--vp-focus), 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .block.dragging {
            opacity: 0.8;
            transform: scale(1.02);
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            z-index: 1000;
        }
        
        .block-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: var(--vp-block-padding);
        }
        
        .block-icon {
            font-size: 16px;
            opacity: 0.9;
        }
        
        .block-label {
            font-weight: 500;
            font-size: 13px;
        }
        
        .block-content {
            padding: 0 16px 8px;
        }
        
        .block-field {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }
        
        .block-field-label {
            font-size: 11px;
            opacity: 0.8;
            min-width: 60px;
        }
        
        .block-field-input {
            flex: 1;
            padding: 4px 8px;
            background: rgba(255,255,255,0.15);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 4px;
            color: white;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }
        
        .block-field-input:focus {
            outline: none;
            background: rgba(255,255,255,0.2);
            border-color: rgba(255,255,255,0.4);
        }
        
        .block-children {
            margin-left: var(--vp-nesting-indent);
            padding: 8px 0;
            border-left: 3px solid rgba(255,255,255,0.3);
            margin-top: 0;
            margin-bottom: 8px;
            margin-right: 8px;
            border-radius: 0 0 0 var(--vp-block-radius);
        }
        
        .block-attachments {
            display: flex;
            flex-direction: column;
        }
        
        .drop-indicator {
            height: 4px;
            background: var(--vp-focus);
            border-radius: 2px;
            margin: 2px 0;
            opacity: 0;
            transition: opacity 0.15s;
        }
        
        .drop-indicator.visible {
            opacity: 1;
        }
        
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vp-text-secondary);
            text-align: center;
            padding: 40px;
        }
        
        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }
        
        .empty-state-title {
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 8px;
        }
        
        .empty-state-description {
            font-size: 14px;
            max-width: 300px;
        }
        
        /* Block colors by category */
        .block[data-category="imports"] { --block-color: #6B7280; }
        .block[data-category="variables"] { --block-color: #8B5CF6; }
        .block[data-category="functions"] { --block-color: #3B82F6; }
        .block[data-category="classes"] { --block-color: #EC4899; }
        .block[data-category="control"] { --block-color: #F59E0B; }
        .block[data-category="loops"] { --block-color: #10B981; }
        .block[data-category="exceptions"] { --block-color: #EF4444; }
        .block[data-category="context"] { --block-color: #06B6D4; }
        .block[data-category="misc"] { --block-color: #6B7280; }
        /* Context menu */
        .context-menu {
            position: fixed;
            background: var(--vp-bg-secondary);
            border: 1px solid var(--vp-border);
            border-radius: 6px;
            padding: 4px 0;
            min-width: 160px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            z-index: 10000;
            display: none;
        }
        
        .context-menu.visible {
            display: block;
        }
        
        .context-menu-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            font-size: 12px;
            cursor: pointer;
            color: var(--vp-text-primary);
        }
        
        .context-menu-item:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .context-menu-item .shortcut {
            margin-left: auto;
            opacity: 0.6;
            font-size: 11px;
        }
        
        .context-menu-separator {
            height: 1px;
            background: var(--vp-border);
            margin: 4px 0;
        }
        
        /* Zoom controls */
        .zoom-controls {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-left: 8px;
        }
        
        .zoom-display {
            min-width: 45px;
            text-align: center;
            font-size: 11px;
            color: var(--vp-text-secondary);
        }
        
        /* Minimap */
        .minimap {
            position: absolute;
            right: 12px;
            top: 12px;
            width: 120px;
            max-height: 200px;
            background: var(--vp-bg-secondary);
            border: 1px solid var(--vp-border);
            border-radius: 6px;
            overflow: hidden;
            opacity: 0.9;
            transition: opacity 0.2s;
        }
        
        .minimap:hover {
            opacity: 1;
        }
        
        .minimap-content {
            transform-origin: top left;
            transform: scale(0.15);
            pointer-events: none;
        }
        
        .minimap-viewport {
            position: absolute;
            border: 2px solid var(--vp-focus);
            background: rgba(59, 130, 246, 0.1);
            border-radius: 2px;
            pointer-events: none;
        }
        
        /* Tooltips */
        .block[title]:hover::after {
            content: attr(title);
            position: absolute;
            bottom: calc(100% + 4px);
            left: 50%;
            transform: translateX(-50%);
            padding: 4px 8px;
            background: var(--vscode-editorHoverWidget-background);
            border: 1px solid var(--vp-border);
            border-radius: 4px;
            font-size: 11px;
            white-space: nowrap;
            z-index: 1000;
            opacity: 0;
            animation: fadeIn 0.2s ease-in forwards;
            animation-delay: 0.5s;
        }
        
        @keyframes fadeIn {
            to { opacity: 1; }
        }
        
        /* Focus styles for accessibility */
        .block:focus {
            outline: 2px solid var(--vp-focus);
            outline-offset: 2px;
        }
        
        .toolbar-button:focus {
            outline: 2px solid var(--vp-focus);
            outline-offset: 2px;
        }
        
        /* Collapsed block state */
        .block.collapsed .block-children,
        .block.collapsed .block-attachments {
            display: none;
        }
        
        .block.collapsed .block-header::after {
            content: ' ▸';
            opacity: 0.6;
        }
        
        /* Block line numbers */
        .block-line-number {
            position: absolute;
            left: -30px;
            top: 8px;
            font-size: 10px;
            color: var(--vp-text-secondary);
            opacity: 0.5;
        }
        
        /* Error state */
        .block.error {
            border: 2px dashed #EF4444;
        }
        
        /* Search highlight */
        .block.search-match {
            box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.4);
        }
    </style>
</head>
<body>
    <div id="app" role="application" aria-label="VisualPy Block Editor">
        <div class="toolbar" role="toolbar" aria-label="Block editor toolbar">
            <button class="toolbar-button" id="btn-undo" title="Undo (Ctrl+Z)" aria-label="Undo">
                ↶
            </button>
            <button class="toolbar-button" id="btn-redo" title="Redo (Ctrl+Y)" aria-label="Redo">
                ↷
            </button>
            <div style="width: 1px; height: 20px; background: var(--vp-border); margin: 0 4px;" aria-hidden="true"></div>
            <!-- Refresh button removed as auto-sync is active -->
            <button class="toolbar-button primary" id="btn-sync" title="Save Blocks to Code" aria-label="Save to Code">
                💾 Save to Code
            </button>
            <div class="sync-indicator synced" id="sync-status" role="status" aria-live="polite">
                <span aria-hidden="true">●</span>
                <span>Synced</span>
            </div>
            <div class="zoom-controls" role="group" aria-label="Zoom controls">
                <button class="toolbar-button" id="btn-zoom-out" title="Zoom Out" aria-label="Zoom out">−</button>
                <span class="zoom-display" id="zoom-display" aria-live="polite">100%</span>
                <button class="toolbar-button" id="btn-zoom-in" title="Zoom In" aria-label="Zoom in">+</button>
                <button class="toolbar-button" id="btn-zoom-reset" title="Reset Zoom" aria-label="Reset zoom">⊡</button>
            </div>
            <div class="toolbar-spacer"></div>
            <button class="toolbar-button" id="btn-collapse-all" title="Collapse All" aria-label="Collapse all blocks">
                ⊟
            </button>
            <button class="toolbar-button" id="btn-expand-all" title="Expand All" aria-label="Expand all blocks">
                ⊞
            </button>
            <button class="toolbar-button" id="btn-delete" title="Delete Selected (Del)" aria-label="Delete selected block">
                🗑️
            </button>
            <span class="toolbar-title" id="file-name">No file open</span>
        </div>
        <div class="main-container">
            <div class="palette" id="palette" role="region" aria-label="Block palette">
                <div class="palette-search">
                    <input type="text" placeholder="Search blocks..." id="palette-search" aria-label="Search blocks">
                </div>
                <div class="palette-content" id="palette-content" role="list">
                    <!-- Palette items will be inserted here -->
                </div>
            </div>
            <div class="canvas-container" id="canvas-container">
                <div class="canvas" id="canvas">
                    <div class="empty-state" id="empty-state">
                        <div class="empty-state-icon">📦</div>
                        <div class="empty-state-title">No blocks yet</div>
                        <div class="empty-state-description">
                            Open a Python file and click Sync, or drag blocks from the palette to get started.
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="context-menu" class="context-menu">
            <div class="context-menu-item" id="cm-duplicate">
                <span>Duplicate</span>
                <span class="shortcut">Ctrl+D</span>
            </div>
            <div class="context-menu-item" id="cm-copy">
                <span>Copy</span>
                <span class="shortcut">Ctrl+C</span>
            </div>
             <div class="context-menu-item" id="cm-paste">
                <span>Paste</span>
                <span class="shortcut">Ctrl+V</span>
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" id="cm-delete">
                <span>Delete</span>
                <span class="shortcut">Del</span>
            </div>
        </div>
    </div>
    <script nonce="${nonce}">
        (function() {
            const vscode = acquireVsCodeApi();
            
            // Global Error Handler
            window.onerror = function(message, source, lineno, colno, error) {
                vscode.postMessage({ 
                    type: 'ERROR', 
                    payload: { message: \`Script Error: \${message} (\${source}:\${lineno})\` } 
                });
                return false;
            };
            
            // --- STATE MANAGEMENT ---
            let blocks = [];
            let selectedBlockId = null;
            let config = {};
            let isDragging = false;
            let draggedBlockId = null;
            let draggedContext = null;
            let zoomLevel = 100;

            // --- LOGGER ---
            function log(level, message) {
                vscode.postMessage({ type: 'LOG', payload: { level, message } });
            }

            // --- DEBOUNCE UTILS ---
            function debounce(func, wait) {
                let timeout;
                return function(...args) {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => func.apply(this, args), wait);
                };
            }

            // --- HISTORY (UNDO/REDO) ---
            const history = {
                past: [],
                future: [],
                maxSize: 50,
                push(state) {
                    this.past.push(JSON.stringify(state));
                    if (this.past.length > this.maxSize) this.past.shift();
                    this.future = [];
                    updateButtons();
                },
                undo() {
                    if (this.past.length === 0) return null;
                    const current = JSON.stringify(blocks);
                    this.future.push(current);
                    const previous = this.past.pop();
                    updateButtons();
                    return JSON.parse(previous);
                },
                redo() {
                    if (this.future.length === 0) return null;
                    const current = JSON.stringify(blocks);
                    this.past.push(current);
                    const next = this.future.pop();
                    updateButtons();
                    return JSON.parse(next);
                }
            };

            function updateButtons() {
                const btnUndo = document.getElementById('btn-undo');
                const btnRedo = document.getElementById('btn-redo');
                if(btnUndo) btnUndo.disabled = history.past.length === 0;
                if(btnRedo) btnRedo.disabled = history.future.length === 0;
            }

            function saveState() {
                history.push(blocks);
            }

            // --- CONSTANTS ---
             const BLOCK_TYPES = {
                imports: [
                    { type: 'import', name: 'Import', icon: '📦' },
                    { type: 'fromImport', name: 'From Import', icon: '📦' }
                ],
                variables: [
                    { type: 'assign', name: 'Assignment', icon: '📝' },
                    { type: 'augAssign', name: 'Aug. Assign', icon: '📝' }
                ],
                functions: [
                    { type: 'function', name: 'Function', icon: '⚡' },
                    { type: 'return', name: 'Return', icon: '↩️' }
                ],
                control: [
                    { type: 'if', name: 'If', icon: '❓' },
                    { type: 'elif', name: 'Elif', icon: '❓' },
                    { type: 'else', name: 'Else', icon: '❓' }
                ],
                loops: [
                    { type: 'for', name: 'For Loop', icon: '🔄' },
                    { type: 'while', name: 'While Loop', icon: '🔄' },
                    { type: 'break', name: 'Break', icon: '⏹️' },
                    { type: 'continue', name: 'Continue', icon: '⏭️' }
                ],
                exceptions: [
                    { type: 'try', name: 'Try', icon: '🛡️' },
                    { type: 'except', name: 'Except', icon: '🛡️' },
                    { type: 'raise', name: 'Raise', icon: '⚠️' }
                ],
                misc: [
                    { type: 'pass', name: 'Pass', icon: '⏩' },
                    { type: 'comment', name: 'Comment', icon: '💬' },
                    { type: 'expression', name: 'Expression', icon: '📊' }
                ]
            };
            
            // --- HELPERS ---
            function escapeHtml(str) {
                if (!str) return '';
                return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            }

            function getBlockIcon(type) {
                 const icons = {
                    import: '📦', fromImport: '📦',
                    assign: '📝', augAssign: '📝', annotatedAssign: '📝',
                    function: '⚡', asyncFunction: '⚡', return: '↩️', yield: '↩️',
                    class: '🏗️',
                    if: '❓', elif: '❓', else: '❓',
                    for: '🔄', while: '🔄', break: '⏹️', continue: '⏭️',
                    try: '🛡️', except: '🛡️', finally: '🛡️', raise: '⚠️',
                    with: '🔐',
                    assert: '✅', pass: '⏩',
                    comment: '💬', expression: '📊', error: '❌'
                };
                return icons[type] || '📦';
            }

            function getBlockLabel(block) {
                 switch (block.type) {
                    case 'import': return 'import ' + (getBlockFieldValue(block, 'modules') || '');
                    case 'fromImport': return 'from ' + (getBlockFieldValue(block, 'module') || '');
                    case 'function': return 'def ' + (getBlockFieldValue(block, 'name') || '');
                    case 'class': return 'class ' + (getBlockFieldValue(block, 'name') || '');
                    case 'if': return 'if ' + (getBlockFieldValue(block, 'condition') || '');
                    case 'for': return 'for ' + (getBlockFieldValue(block, 'target') || '');
                    case 'while': return 'while ' + (getBlockFieldValue(block, 'condition') || '');
                    default: return block.type;
                }
            }
            
            function getBlockFieldValue(block, fieldId) {
                return block.content.editable?.find(f => f.id === fieldId)?.value;
            }
            
            function createBlockFromType(type, category) {
                const id = 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                const templates = {
                    import: { editable: [{ id: 'modules', label: 'Modules', value: 'module' }] },
                    fromImport: { editable: [{ id: 'module', label: 'Module', value: 'module' },{ id: 'names', label: 'Names', value: '*' }] },
                    assign: { editable: [{ id: 'targets', label: 'Variable', value: 'x' }, { id: 'value', label: 'Value', value: '0' }] },
                    function: { editable: [{ id: 'name', label: 'Name', value: 'my_func' }, { id: 'params', label: 'Params', value: '' }], children: [] },
                    if: { editable: [{ id: 'condition', label: 'Condition', value: 'True' }], children: [] },
                    for: { editable: [{ id: 'target', label: 'Var', value: 'i' }, { id: 'iterable', label: 'Iter', value: 'range(10)' }], children: [] },
                    while: { editable: [{ id: 'condition', label: 'Condition', value: 'True' }], children: [] },
                    class: { editable: [{ id: 'name', label: 'Name', value: 'MyClass' }, { id: 'bases', label: 'Bases', value: '' }], children: [] },
                    comment: { editable: [{ id: 'text', label: 'Comment', value: 'Comment here' }] },
                    expression: { editable: [{ id: 'expression', label: 'Expression', value: 'print("Hello")' }] },
                    return: { editable: [{ id: 'value', label: 'Value', value: '' }] }
                };
                
                const template = templates[type] || { editable: [] };
                return {
                    id, type, category,
                    content: { raw: type, editable: template.editable || [] },
                    children: template.children ? [] : undefined,
                    attachments: template.children ? [] : undefined,
                    metadata: { sourceRange: {}, comments: [], collapsed: false }
                };
            }

            // --- RENDERING ---
            function renderBlocks() {
                const canvas = document.getElementById('canvas');
                const emptyState = document.getElementById('empty-state');
                
                // Keep empty state element
                const existingEmpty = canvas.querySelector('#empty-state');
                canvas.innerHTML = '';
                if(existingEmpty) canvas.appendChild(existingEmpty);
                
                if (!blocks || blocks.length === 0) {
                    if(existingEmpty) existingEmpty.style.display = 'flex';
                    return;
                }
                
                if(existingEmpty) existingEmpty.style.display = 'none';
                
                blocks.forEach((block, index) => {
                    canvas.appendChild(createBlockElement(block, index));
                });
            }

            function createBlockElement(block, index) {
                const el = document.createElement('div');
                el.className = 'block' + (block.id === selectedBlockId ? ' selected' : '');
                if (block.metadata?.collapsed) el.classList.add('collapsed');
                if (block.metadata?.error) el.classList.add('error');
                
                el.dataset.id = block.id;
                el.dataset.type = block.type;
                el.dataset.category = block.category;
                el.draggable = true;
                
                // Header
                const header = document.createElement('div');
                header.className = 'block-header';
                header.innerHTML = \`
                    <span class="block-icon">\${getBlockIcon(block.type)}</span>
                    <span class="block-label">\${escapeHtml(getBlockLabel(block))}</span>
                \`;
                el.appendChild(header);
                
                // Content (Fields)
                 if (block.content.editable && block.content.editable.length > 0) {
                    const content = document.createElement('div');
                    content.className = 'block-content';
                    block.content.editable.forEach(field => {
                         const fieldEl = document.createElement('div');
                         fieldEl.className = 'block-field';
                         fieldEl.innerHTML = \`
                             <span class="block-field-label">\${field.label}:</span>
                             <input class="block-field-input" 
                                    type="text" 
                                    value="\${escapeHtml(field.value || '')}"
                                    data-field-id="\${field.id}"
                                    data-block-id="\${block.id}">
                         \`;
                         content.appendChild(fieldEl);
                    });
                    if (content.children.length > 0) {
                        el.appendChild(content);
                    }
                }
                
                // Children (Recursive)
                if (block.children) {
                    const childrenContainer = document.createElement('div');
                    childrenContainer.className = 'block-children';
                    block.children.forEach((child, i) => {
                        childrenContainer.appendChild(createBlockElement(child, i));
                    });
                    el.appendChild(childrenContainer);
                }
                
                // Attachments
                if (block.attachments) {
                    const attachmentsContainer = document.createElement('div');
                    attachmentsContainer.className = 'block-attachments';
                    block.attachments.forEach((att, i) => {
                        attachmentsContainer.appendChild(createBlockElement(att, i));
                    });
                    el.appendChild(attachmentsContainer);
                }
                
                return el;
            }

            // --- CONTEXT MENU ---
            const contextMenu = document.getElementById('context-menu');
            
            function showContextMenu(x, y, blockId) {
                if(!contextMenu) return;
                contextMenu.style.left = x + 'px';
                contextMenu.style.top = y + 'px';
                contextMenu.classList.add('visible');
                selectedBlockId = blockId; // Context click selects
                selectBlock(blockId);
            }
            
            function hideContextMenu() {
                if(contextMenu) contextMenu.classList.remove('visible');
            }
            
            // --- EVENT HANDLING ---
            function setupEventListeners() {
                const canvas = document.getElementById('canvas');
                
                // Canvas Click (Global)
                document.addEventListener('click', (e) => {
                    hideContextMenu();
                    if (!e.target.closest('.block') && !e.target.closest('.palette-item') && !e.target.closest('.toolbar')) {
                         // selectBlock(null); // Optional: Clicking invalid area deselects
                    }
                });

                // Context Menu
                canvas.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    const blockEl = e.target.closest('.block');
                    if (blockEl) {
                        showContextMenu(e.clientX, e.clientY, blockEl.dataset.id);
                    }
                });

                // Delegation: Click
                canvas.addEventListener('click', (e) => {
                     // If input, ignore (allow focus)
                    if (e.target.classList.contains('block-field-input')) return;
                    
                    const blockEl = e.target.closest('.block');
                    e.stopPropagation();
                    
                    if (blockEl) {
                        selectBlock(blockEl.dataset.id);
                    } else {
                        selectBlock(null);
                    }
                });
                
                // Delegation: Double Click (Collapse)
                canvas.addEventListener('dblclick', (e) => {
                    const header = e.target.closest('.block-header');
                    if (header) {
                        const blockEl = header.closest('.block');
                        if (blockEl) toggleCollapse(blockEl.dataset.id);
                    }
                });
                
                // Delegation: Input (Capture & Debounce)
                canvas.addEventListener('input', debounce((e) => {
                     if (e.target.classList.contains('block-field-input')) {
                        const blockId = e.target.dataset.blockId;
                        const fieldId = e.target.dataset.fieldId;
                        const newValue = e.target.value;
                        updateBlockField(blockId, fieldId, newValue);
                    }
                }, 300));
                
                 // Delegation: Drag Start
                canvas.addEventListener('dragstart', (e) => {
                    const blockEl = e.target.closest('.block');
                    if (!blockEl) return;
                    if (e.target.classList.contains('block-field-input')) {
                         e.preventDefault(); 
                         return; // Don't drag if input
                    }
                    if(!blockEl.contains(e.target) && e.target !== blockEl) return; // Only block or header

                    e.stopPropagation();
                    draggedBlockId = blockEl.dataset.id;
                    draggedContext = 'canvas';
                    blockEl.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'block', id: draggedBlockId }));
                });
                
                // Drag Over/End/Drop
                canvas.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                });
                
                canvas.addEventListener('dragend', (e) => {
                    const blockEl = document.querySelector('.block.dragging');
                    if (blockEl) blockEl.classList.remove('dragging');
                    draggedBlockId = null;
                    draggedContext = null;
                });
                
                canvas.addEventListener('drop', handleDrop);
            }
            
            function handleDrop(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const targetBlockEl = e.target.closest('.block');
                const targetId = targetBlockEl ? targetBlockEl.dataset.id : null;
                
                let data;
                try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch(err){}
                
                if (!data) return;
                
                if (data.source === 'palette') {
                    saveState();
                    const newBlock = createBlockFromType(data.type, data.category);
                    if (targetId) insertBlockAfter(newBlock, targetId);
                    else blocks.push(newBlock);
                    
                    renderBlocks();
                    notifyBlocksChanged();
                } else if (draggedContext === 'canvas' && draggedBlockId) {
                    if (draggedBlockId === targetId) return;
                    saveState();
                    moveBlock(draggedBlockId, targetId);
                    renderBlocks();
                    notifyBlocksChanged();
                }
            }
            
            // --- PALETTE ---
            window.handlePaletteDragStart = function(e) {
               e.dataTransfer.setData('text/plain', JSON.stringify({
                   source: 'palette',
                   type: e.target.dataset.type,
                   category: e.target.dataset.category
               }));
            };
            
            function initPalette() {
                const content = document.getElementById('palette-content');
                if(!content) {
                    console.error('Palette content element not found');
                    return;
                }
                content.innerHTML = '';
                
                 for (const [category, items] of Object.entries(BLOCK_TYPES)) {
                    const catDiv = document.createElement('div');
                    catDiv.className = 'palette-category';
                    catDiv.innerHTML = \`<div class="palette-category-header">\${category}</div>\`;
                    const itemsDiv = document.createElement('div');
                    itemsDiv.classList.add('palette-items');
                    items.forEach(item => {
                        const itemEl = document.createElement('div');
                        itemEl.className = 'palette-item';
                        itemEl.draggable = true;
                        itemEl.dataset.type = item.type;
                        itemEl.dataset.category = category;
                        itemEl.innerHTML = \`<span class="palette-item-icon">\${item.icon}</span><span>\${item.name}</span>\`;
                        itemEl.addEventListener('dragstart', window.handlePaletteDragStart);
                        itemsDiv.appendChild(itemEl);
                    });
                    catDiv.appendChild(itemsDiv);
                    content.appendChild(catDiv);
                }
                log('info', 'Palette Initialized with ' + Object.keys(BLOCK_TYPES).length + ' categories');
            }
            
            // --- DATA HELPERS ---
            function findBlock(list, id) {
                 for (const block of list) {
                    if (block.id === id) return block;
                    if (block.children) { const f = findBlock(block.children, id); if(f) return f; }
                    if (block.attachments) { const f = findBlock(block.attachments, id); if(f) return f; }
                }
                return null;
            }

            function updateBlockField(blockId, fieldId, value) {
                const block = findBlock(blocks, blockId);
                if (block && block.content.editable) {
                    const field = block.content.editable.find(f => f.id === fieldId);
                    if (field) {
                        field.value = value;
                        updateSyncStatus('pending');
                        notifyBlocksChanged();
                    }
                }
            }
            
            function selectBlock(id) {
                selectedBlockId = id;
                document.querySelectorAll('.block.selected').forEach(el => el.classList.remove('selected'));
                if (id) {
                    const el = document.querySelector(\`.block[data-id="\${id}"]\`);
                    if(el) el.classList.add('selected');
                    const block = findBlock(blocks, id);
                    if(block) vscode.postMessage({ type: 'BLOCK_SELECTED', payload: { blockId: id, sourceRange: block.metadata.sourceRange } });
                }
            }
            
            function toggleCollapse(id) {
                const block = findBlock(blocks, id);
                if(block) {
                    block.metadata.collapsed = !block.metadata.collapsed;
                    renderBlocks();
                }
            }
            
            function insertBlockAfter(block, targetId) {
                function insert(list) {
                    const idx = list.findIndex(b => b.id === targetId);
                    if(idx !== -1) { list.splice(idx+1, 0, block); return true; }
                    for(const item of list) {
                        if(item.children && insert(item.children)) return true;
                        if(item.attachments && insert(item.attachments)) return true;
                    }
                    return false;
                }
                if(!insert(blocks)) blocks.push(block);
            }
            
            function moveBlock(id, targetId) {
                let moved = null;
                function remove(list) {
                     const idx = list.findIndex(b => b.id === id);
                     if(idx !== -1) { moved = list[idx]; list.splice(idx, 1); return true; }
                     for(const item of list) {
                         if(item.children && remove(item.children)) return true;
                         if(item.attachments && remove(item.attachments)) return true;
                     }
                     return false;
                }
                remove(blocks);
                if(moved) {
                    if(targetId) insertBlockAfter(moved, targetId);
                    else blocks.push(moved);
                }
            }

            function notifyBlocksChanged() {
                vscode.postMessage({ type: 'BLOCKS_CHANGED', payload: { blocks } });
            }
            
            function updateSyncStatus(status) {
                 const el = document.getElementById('sync-status');
                 if(el) {
                    el.className = 'sync-indicator ' + status;
                    const text = { synced: 'Synced', pending: 'Pending', error: 'Error' }[status];
                    el.innerHTML = \`<span>●</span><span>\${text}</span>\`;
                 }
            }

            // --- INITIALIZATION ---
            setupEventListeners();
            initPalette();
            
            // Bind Toolbar Buttons
            document.getElementById('btn-sync').onclick = () => { 
                // Send blocks payload!
                vscode.postMessage({ type: 'REQUEST_SYNC', payload: { direction: 'toCode', blocks } }); 
            };
            // Refresh removed
            document.getElementById('btn-undo').onclick = () => { const s = history.undo(); if(s) { blocks=s; renderBlocks(); notifyBlocksChanged(); } };
            document.getElementById('btn-redo').onclick = () => { const s = history.redo(); if(s) { blocks=s; renderBlocks(); notifyBlocksChanged(); } };
            
            
            let clipboardBlock = null;

            document.getElementById('cm-copy').onclick = () => {
                if(selectedBlockId) {
                    const block = findBlock(blocks, selectedBlockId);
                    if(block) {
                        clipboardBlock = JSON.parse(JSON.stringify(block));
                        hideContextMenu();
                        // Visual feedback
                        vscode.postMessage({ type: 'LOG', payload: { level: 'info', message: 'Block copied to clipboard' } });
                    }
                }
            };

            document.getElementById('cm-paste').onclick = () => {
                if(clipboardBlock && selectedBlockId) {
                    saveState();
                    const newBlock = JSON.parse(JSON.stringify(clipboardBlock));
                    newBlock.id = 'block_' + Date.now() + '_copy';
                    
                    // Deep re-ID
                    function reId(b) {
                        b.id = 'block_' + Date.now() + Math.random().toString(36).substr(2,5);
                        if(b.children) b.children.forEach(reId);
                        if(b.attachments) b.attachments.forEach(reId);
                    }
                    if(newBlock.children) newBlock.children.forEach(reId);
                    if(newBlock.attachments) newBlock.attachments.forEach(reId);

                    insertBlockAfter(newBlock, selectedBlockId);
                    renderBlocks();
                    notifyBlocksChanged();
                    hideContextMenu();
                }
            };

            document.getElementById('cm-delete').onclick = () => {
                if(selectedBlockId) {
                    saveState();
                     function remove(list) {
                        const idx = list.findIndex(b => b.id === selectedBlockId);
                        if(idx!==-1) { list.splice(idx,1); return true; }
                         for(const i of list) { if(i.children && remove(i.children)) return true;  if(i.attachments && remove(i.attachments)) return true; }
                        return false;
                    }
                    remove(blocks);
                    selectedBlockId = null; 
                    renderBlocks(); 
                    notifyBlocksChanged();
                    hideContextMenu();
                }
            };
            
            document.getElementById('cm-duplicate').onclick = () => {
                 if(selectedBlockId) {
                     const block = findBlock(blocks, selectedBlockId);
                     if(block) {
                         saveState();
                         const newBlock = JSON.parse(JSON.stringify(block));
                         newBlock.id = 'block_' + Date.now() + '_dup';
                         
                         // Deep re-ID
                        function reId(b) {
                            b.id = 'block_' + Date.now() + Math.random().toString(36).substr(2,5);
                            if(b.children) b.children.forEach(reId);
                            if(b.attachments) b.attachments.forEach(reId);
                        }
                        if(newBlock.children) newBlock.children.forEach(reId);
                        if(newBlock.attachments) newBlock.attachments.forEach(reId);

                         insertBlockAfter(newBlock, selectedBlockId);
                         renderBlocks();
                         notifyBlocksChanged();
                         hideContextMenu();
                     }
                 }
            };

            // --- MESSAGE HANDLER ---
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.type) {
                    case 'INIT':
                        blocks = message.payload.blocks || [];
                        config = message.payload.config || {}; // Update config
                        renderBlocks();
                        updateSyncStatus('synced');
                        break;
                    case 'UPDATE_BLOCKS':
                        blocks = message.payload.blocks || [];
                        renderBlocks();
                        updateSyncStatus('synced');
                        break;
                    case 'SYNC_STATUS':
                        updateSyncStatus(message.payload.status);
                        break;
                }
            });

            vscode.postMessage({ type: 'READY' });

        })();
    </script>
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
            this.blocks = astToBlocks(parseResult);

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
        } catch (error) {
            Logger.error('Failed to parse and send blocks', error);
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
                // Don't send blocks back immediately to avoid loop, just status
                this.sendMessage({
                    type: 'SYNC_STATUS',
                    payload: { status: 'synced' }
                });
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
            // Short timeout to allow VS Code events to settle before processing new changes
            setTimeout(() => {
                this.isUpdatingCode = false;
            }, 100);
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
        if (this.isUpdatingCode) {
            return;
        }

        Logger.debug('Document edited externally');

        const config = getConfig();
        if (config.syncMode === 'realtime') {
            this.parseAndSendBlocks();
        } else {
            this.syncStatus = 'pending';
            this.sendMessage({
                type: 'SYNC_STATUS',
                payload: { status: 'pending' }
            });
            // Auto-refresh blocks logic:
            // If the user didn't initiate the change (it's external), we should probably update the view
            // But we need to be careful not to overwrite their block edits if they are editing blocks.
            // For now, let's auto-update blocks if we are NOT in the middle of a block edit.

            // Actually, the issue reported is "Stale State: The blocks do not update when the Python file is edited externally".
            // So we MUST call parseAndSendBlocks here, but maybe verify if we have pending block changes?
            // "Refresh" button exists for manual override.
            // Let's force update for now as per "Test 2" requirement.
            this.parseAndSendBlocks();
        }
    }, 500);

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
