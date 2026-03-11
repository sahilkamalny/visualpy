/**
 * Block & message types for the webview.
 * Mirrors the extension-side types from src/types/blocks.ts and src/types/messages.ts
 */

export type BlockType =
    | 'import' | 'fromImport'
    | 'assign' | 'augAssign' | 'annotatedAssign'
    | 'function' | 'asyncFunction' | 'return' | 'yield'
    | 'class'
    | 'if' | 'elif' | 'else'
    | 'for' | 'while' | 'break' | 'continue'
    | 'try' | 'except' | 'finally' | 'raise'
    | 'with'
    | 'assert' | 'pass'
    | 'comment' | 'expression'
    | 'error';

export type BlockCategory =
    | 'imports' | 'variables' | 'functions' | 'classes'
    | 'control' | 'loops' | 'exceptions' | 'context' | 'misc';

export interface EditableField {
    id: string;
    label: string;
    value: string;
    placeholder?: string;
}

export interface BlockContent {
    raw: string;
    editable: EditableField[];
}

export interface SourceRange {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
}

export interface BlockMetadata {
    sourceRange: SourceRange;
    comments: Array<{ line: number; column: number; text: string; inline: boolean }>;
    collapsed: boolean;
    error?: string;
}

export interface Block {
    id: string;
    type: BlockType;
    category: BlockCategory;
    content: BlockContent;
    children?: Block[];
    attachments?: Block[];
    metadata: BlockMetadata;
}

// --- Message Types ---

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'error';

export type Theme = 'dark' | 'light' | 'high-contrast';

export interface Config {
    syncMode: 'manual' | 'onSave' | 'realtime';
    indentSize: number;
    indentStyle: 'spaces' | 'tabs';
    defaultZoom: number;
    showMinimap: boolean;
    palettePosition: 'left' | 'right' | 'hidden';
}

// Extension → Webview
export type ExtensionMessage =
    | { type: 'INIT'; payload: { blocks: Block[]; theme: Theme; config: Config; fileName: string } }
    | { type: 'UPDATE_BLOCKS'; payload: { blocks: Block[]; fileName?: string } }
    | { type: 'SYNC_STATUS'; payload: { status: SyncStatus; message?: string } }
    | { type: 'THEME_CHANGED'; payload: { theme: Theme } }
    | { type: 'CONFIG_CHANGED'; payload: { config: Partial<Config> } }
    | { type: 'PARSE_ERROR'; payload: { errors: Array<{ message: string; line: number }> } }
    | { type: 'CURSOR_HIGHLIGHT'; payload: { line: number | null } };

// Webview → Extension
export type WebviewMessage =
    | { type: 'READY' }
    | { type: 'BLOCKS_CHANGED'; payload: { blocks: Block[] } }
    | { type: 'REQUEST_SYNC'; payload: { direction: 'toCode' | 'toBlocks'; blocks?: Block[] } }
    | { type: 'BLOCK_SELECTED'; payload: { blockId: string; sourceRange: { startLine: number; endLine: number } } }
    | { type: 'REQUEST_PARSE' }
    | { type: 'LOG'; payload: { level: 'info' | 'warn' | 'error'; message: string } }
    | { type: 'ERROR'; payload: { message: string } };

// --- Constants ---

export const BLOCK_COLORS: Record<BlockCategory, { primary: string; accent: string }> = {
    imports: { primary: '#6B7280', accent: '#9CA3AF' },
    variables: { primary: '#8B5CF6', accent: '#A78BFA' },
    functions: { primary: '#3B82F6', accent: '#60A5FA' },
    classes: { primary: '#EC4899', accent: '#F472B6' },
    control: { primary: '#F59E0B', accent: '#FBBF24' },
    loops: { primary: '#10B981', accent: '#34D399' },
    exceptions: { primary: '#EF4444', accent: '#F87171' },
    context: { primary: '#06B6D4', accent: '#22D3EE' },
    misc: { primary: '#6B7280', accent: '#9CA3AF' },
};

export const BLOCK_ICONS: Record<BlockType, string> = {
    import: '📦', fromImport: '📦',
    assign: '📝', augAssign: '📝', annotatedAssign: '📝',
    function: '⚡', asyncFunction: '⚡', return: '↩️', yield: '↩️',
    class: '🏗️',
    if: '❓', elif: '❓', else: '❓',
    for: '🔄', while: '🔄', break: '⏹️', continue: '⏭️',
    try: '🛡️', except: '🛡️', finally: '🛡️', raise: '⚠️',
    with: '🔐',
    assert: '✅', pass: '⏩',
    comment: '💬', expression: '📊', error: '❌',
};

export interface PaletteCategory {
    name: string;
    items: Array<{ type: BlockType; name: string; icon: string }>;
}

export const PALETTE_CATEGORIES: PaletteCategory[] = [
    {
        name: 'imports',
        items: [
            { type: 'import', name: 'Import', icon: '📦' },
            { type: 'fromImport', name: 'From Import', icon: '📦' },
        ],
    },
    {
        name: 'variables',
        items: [
            { type: 'assign', name: 'Assignment', icon: '📝' },
            { type: 'augAssign', name: 'Aug. Assign', icon: '📝' },
        ],
    },
    {
        name: 'functions',
        items: [
            { type: 'function', name: 'Function', icon: '⚡' },
            { type: 'return', name: 'Return', icon: '↩️' },
            { type: 'pass', name: 'Pass', icon: '⏩' },
        ],
    },
    {
        name: 'control',
        items: [
            { type: 'if', name: 'If', icon: '❓' },
            { type: 'elif', name: 'Elif', icon: '❓' },
            { type: 'else', name: 'Else', icon: '❓' },
        ],
    },
    {
        name: 'loops',
        items: [
            { type: 'for', name: 'For Loop', icon: '🔄' },
            { type: 'while', name: 'While Loop', icon: '🔄' },
            { type: 'break', name: 'Break', icon: '⏹️' },
            { type: 'continue', name: 'Continue', icon: '⏭️' },
        ],
    },
    {
        name: 'exceptions',
        items: [
            { type: 'try', name: 'Try', icon: '🛡️' },
            { type: 'except', name: 'Except', icon: '🛡️' },
            { type: 'raise', name: 'Raise', icon: '⚠️' },
        ],
    },
    {
        name: 'misc',
        items: [
            { type: 'comment', name: 'Comment', icon: '💬' },
            { type: 'expression', name: 'Expression', icon: '📊' },
        ],
    },
];

/** Default block templates for creating new blocks from the palette */
export const BLOCK_TEMPLATES: Partial<Record<BlockType, { editable: EditableField[]; hasChildren: boolean }>> = {
    import: { editable: [{ id: 'modules', label: 'Modules', value: 'module' }], hasChildren: false },
    fromImport: { editable: [{ id: 'module', label: 'Module', value: 'module' }, { id: 'names', label: 'Names', value: '*' }], hasChildren: false },
    assign: { editable: [{ id: 'targets', label: 'Variable', value: 'x' }, { id: 'value', label: 'Value', value: '0' }], hasChildren: false },
    augAssign: { editable: [{ id: 'target', label: 'Variable', value: 'x' }, { id: 'operator', label: 'Operator', value: '+' }, { id: 'value', label: 'Value', value: '1' }], hasChildren: false },
    function: { editable: [{ id: 'name', label: 'Name', value: 'my_func' }, { id: 'params', label: 'Params', value: '' }], hasChildren: true },
    return: { editable: [{ id: 'value', label: 'Value', value: '' }], hasChildren: false },
    pass: { editable: [], hasChildren: false },
    class: { editable: [{ id: 'name', label: 'Name', value: 'MyClass' }, { id: 'bases', label: 'Bases', value: '' }], hasChildren: true },
    if: { editable: [{ id: 'condition', label: 'Condition', value: '' }], hasChildren: true },
    elif: { editable: [{ id: 'condition', label: 'Condition', value: '' }], hasChildren: true },
    else: { editable: [], hasChildren: true },
    for: { editable: [{ id: 'target', label: 'Var', value: 'i' }, { id: 'iterable', label: 'Iter', value: 'range(10)' }], hasChildren: true },
    while: { editable: [{ id: 'condition', label: 'Condition', value: '' }], hasChildren: true },
    break: { editable: [], hasChildren: false },
    continue: { editable: [], hasChildren: false },
    try: { editable: [], hasChildren: true },
    except: { editable: [{ id: 'exception', label: 'Exception', value: 'Exception' }], hasChildren: true },
    raise: { editable: [{ id: 'exception', label: 'Exception', value: 'Exception()' }], hasChildren: false },
    comment: { editable: [{ id: 'text', label: 'Comment', value: 'Comment here' }], hasChildren: false },
    expression: { editable: [{ id: 'expression', label: 'Code', value: 'print("Hello")' }], hasChildren: false },
};
