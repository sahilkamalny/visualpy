/**
 * Shared utilities for the webview.
 */

/** Debounce a function by `wait` milliseconds */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, wait: number): T {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return ((...args: unknown[]) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    }) as T;
}

/** Escape HTML special characters */
export function escapeHtml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Deep clone an object via structured clone (or JSON fallback) */
export function deepClone<T>(obj: T): T {
    if (typeof structuredClone === 'function') {
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
}

/** Generate a unique block ID */
export function generateId(): string {
    return 'block_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

/** Get the label text for a block */
export function getBlockLabel(block: { type: string; content: { editable: Array<{ id: string; value: string }> } }): string {
    const field = (id: string) => block.content.editable?.find(f => f.id === id)?.value || '';

    switch (block.type) {
        case 'import': return 'import ' + field('modules');
        case 'fromImport': return 'from ' + field('module') + ' import ' + field('names');
        case 'assign': return field('targets') + ' = ' + field('value');
        case 'augAssign': return field('targets') + ' ' + field('op') + ' ' + field('value');
        case 'function': return 'def ' + field('name') + '(' + field('params') + ')';
        case 'class': return 'class ' + field('name');
        case 'if': return 'if ' + field('condition');
        case 'elif': return 'elif ' + field('condition');
        case 'else': return 'else';
        case 'for': return 'for ' + field('target') + ' in ' + field('iterable');
        case 'while': return 'while ' + field('condition');
        case 'return': return 'return ' + field('value');
        case 'pass': return 'pass';
        case 'break': return 'break';
        case 'continue': return 'continue';
        case 'try': return 'try';
        case 'except': return 'except ' + field('exception');
        case 'raise': return 'raise ' + field('exception');
        case 'comment': {
            const text = field('text');
            return text.length > 40 ? text.substring(0, 40) + '…' : text;
        }
        case 'expression': {
            const expr = field('expression');
            return expr.length > 40 ? expr.substring(0, 40) + '…' : expr;
        }
        default: return block.type;
    }
}
