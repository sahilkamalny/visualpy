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
    </style>
</head>
<body>
    <div id="app">
        <div class="toolbar">
            <button class="toolbar-button" id="btn-undo" title="Undo (Ctrl+Z)">
                ↶
            </button>
            <button class="toolbar-button" id="btn-redo" title="Redo (Ctrl+Y)">
                ↷
            </button>
            <div style="width: 1px; height: 20px; background: var(--vp-border); margin: 0 4px;"></div>
            <button class="toolbar-button primary" id="btn-sync" title="Sync Code ↔ Blocks">
                ↻ Sync
            </button>
            <div class="sync-indicator synced" id="sync-status">
                <span>●</span>
                <span>Synced</span>
            </div>
            <div class="toolbar-spacer"></div>
            <button class="toolbar-button" id="btn-delete" title="Delete Selected (Del)">
                🗑️
            </button>
            <span class="toolbar-title" id="file-name">No file open</span>
        </div>
        <div class="main-container">
            <div class="palette" id="palette">
                <div class="palette-search">
                    <input type="text" placeholder="Search blocks..." id="palette-search">
                </div>
                <div class="palette-content" id="palette-content">
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
    </div>
    <script nonce="${nonce}">
        (function() {
            const vscode = acquireVsCodeApi();
            
            // State
            let blocks = [];
            let selectedBlockId = null;
            let draggedBlock = null;
            let config = {};
            
            // Block type definitions
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
            
            // Initialize palette
            function initPalette() {
                const content = document.getElementById('palette-content');
                content.innerHTML = '';
                
                for (const [category, items] of Object.entries(BLOCK_TYPES)) {
                    const categoryEl = document.createElement('div');
                    categoryEl.className = 'palette-category';
                    categoryEl.innerHTML = \`
                        <div class="palette-category-header">
                            <span>▼</span>
                            <span>\${category}</span>
                        </div>
                        <div class="palette-items">
                            \${items.map(item => \`
                                <div class="palette-item" 
                                     data-type="\${item.type}" 
                                     data-category="\${category}"
                                     draggable="true">
                                    <span class="palette-item-icon">\${item.icon}</span>
                                    <span>\${item.name}</span>
                                </div>
                            \`).join('')}
                        </div>
                    \`;
                    content.appendChild(categoryEl);
                }
                
                // Add drag handlers
                content.querySelectorAll('.palette-item').forEach(item => {
                    item.addEventListener('dragstart', handlePaletteDragStart);
                    item.addEventListener('dragend', handleDragEnd);
                });
            }
            
            // Render blocks
            function renderBlocks() {
                const canvas = document.getElementById('canvas');
                const emptyState = document.getElementById('empty-state');
                
                if (blocks.length === 0) {
                    emptyState.style.display = 'flex';
                    return;
                }
                
                emptyState.style.display = 'none';
                
                // Clear and rebuild
                canvas.innerHTML = '';
                blocks.forEach((block, index) => {
                    canvas.appendChild(renderBlock(block, index));
                });
            }
            
            function renderBlock(block, index) {
                const el = document.createElement('div');
                el.className = 'block' + (block.id === selectedBlockId ? ' selected' : '');
                el.dataset.id = block.id;
                el.dataset.category = block.category;
                el.dataset.index = index;
                el.draggable = true;
                
                // Header
                const header = document.createElement('div');
                header.className = 'block-header';
                header.innerHTML = \`
                    <span class="block-icon">\${getBlockIcon(block.type)}</span>
                    <span class="block-label">\${getBlockLabel(block)}</span>
                \`;
                el.appendChild(header);
                
                // Editable fields
                if (block.content.editable && block.content.editable.length > 0) {
                    const content = document.createElement('div');
                    content.className = 'block-content';
                    block.content.editable.forEach(field => {
                        if (field.value || field.id === 'expression' || field.id === 'text') {
                            const fieldEl = document.createElement('div');
                            fieldEl.className = 'block-field';
                            fieldEl.innerHTML = \`
                                <span class="block-field-label">\${field.label}:</span>
                                <input class="block-field-input" 
                                       type="text" 
                                       value="\${escapeHtml(field.value)}"
                                       data-field-id="\${field.id}"
                                       data-block-id="\${block.id}">
                            \`;
                            content.appendChild(fieldEl);
                        }
                    });
                    if (content.children.length > 0) {
                        el.appendChild(content);
                    }
                }
                
                // Children (for compound blocks)
                if (block.children && block.children.length > 0) {
                    const childrenContainer = document.createElement('div');
                    childrenContainer.className = 'block-children';
                    block.children.forEach((child, i) => {
                        childrenContainer.appendChild(renderBlock(child, i));
                    });
                    el.appendChild(childrenContainer);
                }
                
                // Attachments (elif, else, except, finally)
                if (block.attachments && block.attachments.length > 0) {
                    const attachmentsContainer = document.createElement('div');
                    attachmentsContainer.className = 'block-attachments';
                    block.attachments.forEach((att, i) => {
                        attachmentsContainer.appendChild(renderBlock(att, i));
                    });
                    el.appendChild(attachmentsContainer);
                }
                
                // Event handlers
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectBlock(block.id);
                });
                
                el.addEventListener('dragstart', handleBlockDragStart);
                el.addEventListener('dragend', handleDragEnd);
                el.addEventListener('dragover', handleDragOver);
                el.addEventListener('drop', handleDrop);
                
                // Field change handlers
                el.querySelectorAll('.block-field-input').forEach(input => {
                    input.addEventListener('change', handleFieldChange);
                    input.addEventListener('click', e => e.stopPropagation());
                });
                
                return el;
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
                    case 'import': return 'import ' + (block.content.editable[0]?.value || '');
                    case 'fromImport': return 'from ' + (block.content.editable[0]?.value || '');
                    case 'function': return 'def ' + (block.content.editable[0]?.value || '');
                    case 'class': return 'class ' + (block.content.editable[0]?.value || '');
                    case 'if': return 'if';
                    case 'elif': return 'elif';
                    case 'else': return 'else';
                    case 'for': return 'for';
                    case 'while': return 'while';
                    case 'try': return 'try';
                    case 'except': return 'except';
                    case 'finally': return 'finally';
                    default: return block.type;
                }
            }
            
            function escapeHtml(str) {
                if (!str) return '';
                return str.replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;')
                          .replace(/"/g, '&quot;');
            }
            
            function selectBlock(id) {
                selectedBlockId = id;
                
                // Update visual selection
                document.querySelectorAll('.block.selected').forEach(el => {
                    el.classList.remove('selected');
                });
                
                const selected = document.querySelector(\`.block[data-id="\${id}"]\`);
                if (selected) {
                    selected.classList.add('selected');
                }
                
                // Notify extension
                const block = findBlock(blocks, id);
                if (block) {
                    vscode.postMessage({
                        type: 'BLOCK_SELECTED',
                        payload: {
                            blockId: id,
                            sourceRange: block.metadata.sourceRange
                        }
                    });
                }
            }
            
            function findBlock(blockList, id) {
                for (const block of blockList) {
                    if (block.id === id) return block;
                    if (block.children) {
                        const found = findBlock(block.children, id);
                        if (found) return found;
                    }
                    if (block.attachments) {
                        const found = findBlock(block.attachments, id);
                        if (found) return found;
                    }
                }
                return null;
            }
            
            // Drag and drop handlers
            function handlePaletteDragStart(e) {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    source: 'palette',
                    type: e.target.dataset.type,
                    category: e.target.dataset.category
                }));
                e.dataTransfer.effectAllowed = 'copy';
            }
            
            function handleBlockDragStart(e) {
                e.stopPropagation();
                e.target.classList.add('dragging');
                draggedBlock = e.target;
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    source: 'canvas',
                    id: e.target.dataset.id
                }));
                e.dataTransfer.effectAllowed = 'move';
            }
            
            function handleDragOver(e) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
            }
            
            function handleDrop(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const targetId = e.currentTarget.dataset.id;
                
                if (data.source === 'palette') {
                    // Create new block from palette
                    const newBlock = createBlockFromType(data.type, data.category);
                    insertBlockAfter(newBlock, targetId);
                } else if (data.source === 'canvas' && data.id !== targetId) {
                    // Move existing block
                    moveBlock(data.id, targetId);
                }
                
                notifyBlocksChanged();
            }
            
            function handleDragEnd(e) {
                e.target.classList.remove('dragging');
                draggedBlock = null;
            }
            
            function createBlockFromType(type, category) {
                const id = 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                
                const templates = {
                    import: { editable: [{ id: 'modules', label: 'Modules', value: 'module' }] },
                    fromImport: { editable: [
                        { id: 'module', label: 'Module', value: 'module' },
                        { id: 'names', label: 'Names', value: 'name' }
                    ]},
                    assign: { editable: [
                        { id: 'targets', label: 'Variable', value: 'x' },
                        { id: 'value', label: 'Value', value: '0' }
                    ]},
                    function: { editable: [
                        { id: 'name', label: 'Name', value: 'my_function' },
                        { id: 'params', label: 'Parameters', value: '' }
                    ], children: [{ type: 'pass', category: 'misc', id: id + '_pass', content: { raw: 'pass', editable: [] }, metadata: { sourceRange: {}, comments: [], collapsed: false } }] },
                    if: { editable: [{ id: 'condition', label: 'Condition', value: 'True' }], children: [{ type: 'pass', category: 'misc', id: id + '_pass', content: { raw: 'pass', editable: [] }, metadata: { sourceRange: {}, comments: [], collapsed: false } }] },
                    for: { editable: [
                        { id: 'target', label: 'Variable', value: 'i' },
                        { id: 'iterable', label: 'Iterable', value: 'range(10)' }
                    ], children: [{ type: 'pass', category: 'misc', id: id + '_pass', content: { raw: 'pass', editable: [] }, metadata: { sourceRange: {}, comments: [], collapsed: false } }] },
                    while: { editable: [{ id: 'condition', label: 'Condition', value: 'True' }], children: [{ type: 'pass', category: 'misc', id: id + '_pass', content: { raw: 'pass', editable: [] }, metadata: { sourceRange: {}, comments: [], collapsed: false } }] },
                    comment: { editable: [{ id: 'text', label: 'Comment', value: 'Comment here' }] },
                    expression: { editable: [{ id: 'expression', label: 'Expression', value: 'print("Hello")' }] },
                    pass: { editable: [] },
                    break: { editable: [] },
                    continue: { editable: [] },
                    return: { editable: [{ id: 'value', label: 'Value', value: '' }] }
                };
                
                const template = templates[type] || { editable: [] };
                
                return {
                    id,
                    type,
                    category,
                    content: {
                        raw: type,
                        editable: template.editable || []
                    },
                    children: template.children,
                    attachments: template.attachments,
                    metadata: {
                        sourceRange: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 0 },
                        comments: [],
                        collapsed: false
                    }
                };
            }
            
            function insertBlockAfter(newBlock, targetId) {
                // Find and insert after target
                const index = blocks.findIndex(b => b.id === targetId);
                if (index >= 0) {
                    blocks.splice(index + 1, 0, newBlock);
                } else {
                    blocks.push(newBlock);
                }
                renderBlocks();
            }
            
            function moveBlock(sourceId, targetId) {
                // Remove from current position
                let movedBlock = null;
                blocks = blocks.filter(b => {
                    if (b.id === sourceId) {
                        movedBlock = b;
                        return false;
                    }
                    return true;
                });
                
                if (movedBlock) {
                    // Insert after target
                    const targetIndex = blocks.findIndex(b => b.id === targetId);
                    if (targetIndex >= 0) {
                        blocks.splice(targetIndex + 1, 0, movedBlock);
                    } else {
                        blocks.push(movedBlock);
                    }
                }
                
                renderBlocks();
            }
            
            function handleFieldChange(e) {
                const blockId = e.target.dataset.blockId;
                const fieldId = e.target.dataset.fieldId;
                const value = e.target.value;
                
                // Update block data
                const block = findBlock(blocks, blockId);
                if (block) {
                    const field = block.content.editable.find(f => f.id === fieldId);
                    if (field) {
                        field.value = value;
                    }
                    block.content.raw = value; // Update raw for simple blocks
                }
                
                notifyBlocksChanged();
            }
            
            function notifyBlocksChanged() {
                updateSyncStatus('pending');
                vscode.postMessage({
                    type: 'BLOCKS_CHANGED',
                    payload: { blocks }
                });
            }
            
            function updateSyncStatus(status, message) {
                const el = document.getElementById('sync-status');
                el.className = 'sync-indicator ' + status;
                const labels = { synced: 'Synced', pending: 'Pending', error: 'Error' };
                el.innerHTML = '<span>●</span><span>' + (message || labels[status]) + '</span>';
            }
            
            // Button handlers
            document.getElementById('btn-sync').addEventListener('click', () => {
                vscode.postMessage({ type: 'REQUEST_SYNC', payload: { direction: 'toCode' } });
            });
            
            // Undo button
            document.getElementById('btn-undo').addEventListener('click', () => {
                undo();
            });
            
            // Redo button
            document.getElementById('btn-redo').addEventListener('click', () => {
                redo();
            });
            
            // Delete button
            document.getElementById('btn-delete').addEventListener('click', () => {
                deleteSelectedBlock();
            });
            
            // Context menu
            const contextMenu = document.createElement('div');
            contextMenu.className = 'context-menu';
            contextMenu.innerHTML = \`
                <div class="context-menu-item" data-action="duplicate">
                    📋 Duplicate <span class="shortcut">Ctrl+D</span>
                </div>
                <div class="context-menu-item" data-action="copy">
                    📄 Copy <span class="shortcut">Ctrl+C</span>
                </div>
                <div class="context-menu-item" data-action="paste">
                    📥 Paste <span class="shortcut">Ctrl+V</span>
                </div>
                <div class="context-menu-separator"></div>
                <div class="context-menu-item" data-action="delete">
                    🗑️ Delete <span class="shortcut">Del</span>
                </div>
            \`;
            document.body.appendChild(contextMenu);
            
            // Show context menu on right-click
            document.getElementById('canvas').addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const blockEl = e.target.closest('.block');
                if (blockEl) {
                    selectBlock(blockEl.dataset.id);
                }
                contextMenu.style.left = e.clientX + 'px';
                contextMenu.style.top = e.clientY + 'px';
                contextMenu.classList.add('visible');
            });
            
            // Hide context menu
            document.addEventListener('click', () => {
                contextMenu.classList.remove('visible');
            });
            
            // Handle context menu actions
            contextMenu.addEventListener('click', (e) => {
                const action = e.target.closest('.context-menu-item')?.dataset.action;
                if (!action) return;
                
                switch (action) {
                    case 'duplicate': duplicateSelectedBlock(); break;
                    case 'copy': copySelectedBlock(); break;
                    case 'paste': pasteBlock(); break;
                    case 'delete': deleteSelectedBlock(); break;
                }
                contextMenu.classList.remove('visible');
            });
            
            // Canvas click to deselect
            document.getElementById('canvas-container').addEventListener('click', () => {
                selectedBlockId = null;
                document.querySelectorAll('.block.selected').forEach(el => {
                    el.classList.remove('selected');
                });
            });
            
            // Canvas drop for new blocks
            document.getElementById('canvas').addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            });
            
            document.getElementById('canvas').addEventListener('drop', (e) => {
                e.preventDefault();
                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (data.source === 'palette') {
                        const newBlock = createBlockFromType(data.type, data.category);
                        blocks.push(newBlock);
                        renderBlocks();
                        notifyBlocksChanged();
                    }
                } catch (err) {
                    console.error('Drop error:', err);
                }
            });
            
            // Undo/Redo history
            const history = {
                past: [],
                future: [],
                maxSize: 50,
                
                push(state) {
                    this.past.push(JSON.stringify(state));
                    if (this.past.length > this.maxSize) {
                        this.past.shift();
                    }
                    this.future = [];
                },
                
                undo() {
                    if (this.past.length === 0) return null;
                    const current = JSON.stringify(blocks);
                    this.future.push(current);
                    const previous = this.past.pop();
                    return JSON.parse(previous);
                },
                
                redo() {
                    if (this.future.length === 0) return null;
                    const current = JSON.stringify(blocks);
                    this.past.push(current);
                    const next = this.future.pop();
                    return JSON.parse(next);
                }
            };
            
            // Clipboard
            let clipboard = null;
            
            // Save state for undo
            function saveState() {
                history.push(blocks);
            }
            
            // Delete selected block
            function deleteSelectedBlock() {
                if (!selectedBlockId) return;
                
                saveState();
                
                function removeFromList(list, id) {
                    const index = list.findIndex(b => b.id === id);
                    if (index >= 0) {
                        list.splice(index, 1);
                        return true;
                    }
                    for (const block of list) {
                        if (block.children && removeFromList(block.children, id)) return true;
                        if (block.attachments && removeFromList(block.attachments, id)) return true;
                    }
                    return false;
                }
                
                removeFromList(blocks, selectedBlockId);
                selectedBlockId = null;
                renderBlocks();
                notifyBlocksChanged();
            }
            
            // Duplicate selected block
            function duplicateSelectedBlock() {
                if (!selectedBlockId) return;
                
                const block = findBlock(blocks, selectedBlockId);
                if (!block) return;
                
                saveState();
                
                function cloneWithNewIds(b) {
                    const newId = 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    const clone = {
                        ...b,
                        id: newId,
                        content: { ...b.content, editable: b.content.editable?.map(e => ({...e})) || [] },
                        metadata: { ...b.metadata, sourceRange: {} }
                    };
                    if (b.children) {
                        clone.children = b.children.map(cloneWithNewIds);
                    }
                    if (b.attachments) {
                        clone.attachments = b.attachments.map(cloneWithNewIds);
                    }
                    return clone;
                }
                
                const duplicate = cloneWithNewIds(block);
                
                // Insert after original
                const index = blocks.findIndex(b => b.id === selectedBlockId);
                if (index >= 0) {
                    blocks.splice(index + 1, 0, duplicate);
                } else {
                    blocks.push(duplicate);
                }
                
                selectedBlockId = duplicate.id;
                renderBlocks();
                notifyBlocksChanged();
            }
            
            // Copy selected block to clipboard
            function copySelectedBlock() {
                if (!selectedBlockId) return;
                const block = findBlock(blocks, selectedBlockId);
                if (block) {
                    clipboard = JSON.stringify(block);
                }
            }
            
            // Paste block from clipboard
            function pasteBlock() {
                if (!clipboard) return;
                
                saveState();
                
                const block = JSON.parse(clipboard);
                
                function assignNewIds(b) {
                    b.id = 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    if (b.children) b.children.forEach(assignNewIds);
                    if (b.attachments) b.attachments.forEach(assignNewIds);
                }
                
                assignNewIds(block);
                
                // Insert after selected or at end
                if (selectedBlockId) {
                    const index = blocks.findIndex(b => b.id === selectedBlockId);
                    if (index >= 0) {
                        blocks.splice(index + 1, 0, block);
                    } else {
                        blocks.push(block);
                    }
                } else {
                    blocks.push(block);
                }
                
                selectedBlockId = block.id;
                renderBlocks();
                notifyBlocksChanged();
            }
            
            // Undo action
            function undo() {
                const prevState = history.undo();
                if (prevState) {
                    blocks = prevState;
                    selectedBlockId = null;
                    renderBlocks();
                    notifyBlocksChanged();
                }
            }
            
            // Redo action
            function redo() {
                const nextState = history.redo();
                if (nextState) {
                    blocks = nextState;
                    selectedBlockId = null;
                    renderBlocks();
                    notifyBlocksChanged();
                }
            }
            
            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                // Don't handle if typing in input
                if (e.target.tagName === 'INPUT') return;
                
                const key = e.key.toLowerCase();
                const ctrlOrMeta = e.ctrlKey || e.metaKey;
                
                if (key === 'delete' || key === 'backspace') {
                    e.preventDefault();
                    deleteSelectedBlock();
                } else if (ctrlOrMeta && key === 'd') {
                    e.preventDefault();
                    duplicateSelectedBlock();
                } else if (ctrlOrMeta && key === 'c') {
                    e.preventDefault();
                    copySelectedBlock();
                } else if (ctrlOrMeta && key === 'v') {
                    e.preventDefault();
                    pasteBlock();
                } else if (ctrlOrMeta && key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    undo();
                } else if ((ctrlOrMeta && key === 'y') || (ctrlOrMeta && e.shiftKey && key === 'z')) {
                    e.preventDefault();
                    redo();
                } else if (key === 'escape') {
                    selectedBlockId = null;
                    document.querySelectorAll('.block.selected').forEach(el => {
                        el.classList.remove('selected');
                    });
                }
            });
            
            // Save state before changes that support undo
            const originalNotifyBlocksChanged = notifyBlocksChanged;
            function notifyBlocksChangedWithHistory() {
                saveState();
                originalNotifyBlocksChanged();
            }
            
            // Message handler
            window.addEventListener('message', (event) => {
                const message = event.data;
                
                switch (message.type) {
                    case 'INIT':
                        blocks = message.payload.blocks || [];
                        config = message.payload.config || {};
                        document.getElementById('file-name').textContent = message.payload.fileName || 'No file';
                        renderBlocks();
                        updateSyncStatus('synced');
                        break;
                        
                    case 'UPDATE_BLOCKS':
                        blocks = message.payload.blocks || [];
                        renderBlocks();
                        break;
                        
                    case 'SYNC_STATUS':
                        updateSyncStatus(message.payload.status, message.payload.message);
                        break;
                        
                    case 'THEME_CHANGED':
                        // Theme is handled by CSS variables
                        break;
                        
                    case 'CONFIG_CHANGED':
                        config = { ...config, ...message.payload.config };
                        break;
                }
            });
            
            // Initialize
            initPalette();
            
            // Signal ready
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
        switch (message.type) {
            case 'READY':
                await this.parseAndSendBlocks();
                break;

            case 'BLOCKS_CHANGED':
                this.blocks = message.payload.blocks;
                this.syncStatus = 'pending';
                const config = getConfig();
                if (config.syncMode === 'realtime') {
                    this.syncBlocksToCode();
                }
                break;

            case 'REQUEST_SYNC':
                if (message.payload.direction === 'toCode') {
                    await this.syncBlocksToCode();
                } else {
                    await this.parseAndSendBlocks();
                }
                break;

            case 'BLOCK_SELECTED':
                // Optionally highlight in editor
                if (this.currentDocument && message.payload.sourceRange) {
                    const range = message.payload.sourceRange;
                    const editor = vscode.window.visibleTextEditors.find(
                        e => e.document === this.currentDocument
                    );
                    if (editor) {
                        const startPos = new vscode.Position(range.startLine - 1, 0);
                        const endPos = new vscode.Position(range.endLine - 1, 0);
                        editor.selection = new vscode.Selection(startPos, startPos);
                        editor.revealRange(
                            new vscode.Range(startPos, endPos),
                            vscode.TextEditorRevealType.InCenter
                        );
                    }
                }
                break;

            case 'LOG':
                const level = message.payload.level;
                if (level === 'error') {
                    Logger.error(message.payload.message);
                } else if (level === 'warn') {
                    Logger.warn(message.payload.message);
                } else {
                    Logger.info(message.payload.message);
                }
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

        const source = this.currentDocument.getText();
        const parseResult = await this.parserService.parse(source);
        this.blocks = astToBlocks(parseResult);

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
    }

    /**
     * Sync blocks back to code
     */
    async syncBlocksToCode(): Promise<void> {
        if (!this.currentDocument || this.isUpdatingCode) {
            return;
        }

        this.isUpdatingCode = true;

        try {
            const code = blocksToCode(this.blocks);
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                this.currentDocument.positionAt(0),
                this.currentDocument.positionAt(this.currentDocument.getText().length)
            );
            edit.replace(this.currentDocument.uri, fullRange, code);

            await vscode.workspace.applyEdit(edit);

            this.syncStatus = 'synced';
            this.sendMessage({
                type: 'SYNC_STATUS',
                payload: { status: 'synced' }
            });
        } catch (error) {
            Logger.error('Failed to sync blocks to code', error);
            this.syncStatus = 'error';
            this.sendMessage({
                type: 'SYNC_STATUS',
                payload: { status: 'error', message: 'Sync failed' }
            });
        } finally {
            this.isUpdatingCode = false;
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

        const config = getConfig();
        if (config.syncMode === 'realtime') {
            this.parseAndSendBlocks();
        } else {
            this.syncStatus = 'pending';
            this.sendMessage({
                type: 'SYNC_STATUS',
                payload: { status: 'pending' }
            });
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
