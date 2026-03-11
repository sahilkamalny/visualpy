/**
 * Block type definitions for VisualPy
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
    | 'imports'
    | 'variables'
    | 'functions'
    | 'classes'
    | 'control'
    | 'loops'
    | 'exceptions'
    | 'context'
    | 'misc';

export interface Range {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
}

export interface Comment {
    line: number;
    column: number;
    text: string;
    inline: boolean;
}

export interface EditableField {
    id: string;
    label: string;
    value: string;
    placeholder?: string;
    validation?: ValidationRule;
}

export interface ValidationRule {
    pattern?: string;
    required?: boolean;
    message?: string;
}

export interface BlockContent {
    raw: string;
    editable: EditableField[];
}

export interface BlockMetadata {
    sourceRange: Range;
    comments: Comment[];
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

// Category to color mapping
export const BLOCK_COLORS: Record<BlockCategory, { primary: string; accent: string }> = {
    imports: { primary: '#6B7280', accent: '#9CA3AF' },
    variables: { primary: '#8B5CF6', accent: '#A78BFA' },
    functions: { primary: '#3B82F6', accent: '#60A5FA' },
    classes: { primary: '#EC4899', accent: '#F472B6' },
    control: { primary: '#F59E0B', accent: '#FBBF24' },
    loops: { primary: '#10B981', accent: '#34D399' },
    exceptions: { primary: '#EF4444', accent: '#F87171' },
    context: { primary: '#06B6D4', accent: '#22D3EE' },
    misc: { primary: '#6B7280', accent: '#9CA3AF' }
};

// Block type to category mapping
export const BLOCK_TYPE_CATEGORY: Record<BlockType, BlockCategory> = {
    import: 'imports',
    fromImport: 'imports',
    assign: 'variables',
    augAssign: 'variables',
    annotatedAssign: 'variables',
    function: 'functions',
    asyncFunction: 'functions',
    return: 'functions',
    yield: 'functions',
    class: 'classes',
    if: 'control',
    elif: 'control',
    else: 'control',
    for: 'loops',
    while: 'loops',
    break: 'loops',
    continue: 'loops',
    try: 'exceptions',
    except: 'exceptions',
    finally: 'exceptions',
    raise: 'exceptions',
    with: 'context',
    assert: 'misc',
    pass: 'functions',
    comment: 'misc',
    expression: 'misc',
    error: 'misc'
};

// Block type display names and icons
export const BLOCK_TYPE_INFO: Record<BlockType, { name: string; icon: string; description: string }> = {
    import: { name: 'Import', icon: '📦', description: 'Import a module' },
    fromImport: { name: 'From Import', icon: '📦', description: 'Import specific items from a module' },
    assign: { name: 'Assignment', icon: '📝', description: 'Assign a value to a variable' },
    augAssign: { name: 'Augmented Assignment', icon: '📝', description: 'Modify and assign (+=, -=, etc.)' },
    annotatedAssign: { name: 'Typed Assignment', icon: '📝', description: 'Assign with type annotation' },
    function: { name: 'Function', icon: '⚡', description: 'Define a function' },
    asyncFunction: { name: 'Async Function', icon: '⚡', description: 'Define an async function' },
    return: { name: 'Return', icon: '↩️', description: 'Return a value from function' },
    yield: { name: 'Yield', icon: '↩️', description: 'Yield a value from generator' },
    class: { name: 'Class', icon: '🏗️', description: 'Define a class' },
    if: { name: 'If', icon: '❓', description: 'Conditional statement' },
    elif: { name: 'Elif', icon: '❓', description: 'Else-if branch' },
    else: { name: 'Else', icon: '❓', description: 'Else branch' },
    for: { name: 'For Loop', icon: '🔄', description: 'Iterate over a sequence' },
    while: { name: 'While Loop', icon: '🔄', description: 'Loop while condition is true' },
    break: { name: 'Break', icon: '⏹️', description: 'Exit the current loop' },
    continue: { name: 'Continue', icon: '⏭️', description: 'Skip to next iteration' },
    try: { name: 'Try', icon: '🛡️', description: 'Try block for exception handling' },
    except: { name: 'Except', icon: '🛡️', description: 'Handle an exception' },
    finally: { name: 'Finally', icon: '🛡️', description: 'Always execute this block' },
    raise: { name: 'Raise', icon: '⚠️', description: 'Raise an exception' },
    with: { name: 'With', icon: '🔐', description: 'Context manager' },
    assert: { name: 'Assert', icon: '✅', description: 'Assert a condition' },
    pass: { name: 'Pass', icon: '⏩', description: 'Do nothing (placeholder)' },
    comment: { name: 'Comment', icon: '💬', description: 'Code comment' },
    expression: { name: 'Expression', icon: '📊', description: 'Expression statement' },
    error: { name: 'Error', icon: '❌', description: 'Syntax error in code' }
};
