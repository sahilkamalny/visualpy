import { Block, BlockType } from '../types/blocks';
import { Config } from '../types/messages';
import { getConfig } from '../utils/config';

/**
 * Convert block tree back to Python code
 */
export function blocksToCode(blocks: Block[], config?: Partial<Config>): string {
    const settings = { ...getConfig(), ...config };
    const indent = settings.indentStyle === 'tabs'
        ? '\t'
        : ' '.repeat(settings.indentSize);

    const lines: string[] = [];

    for (const block of blocks) {
        const blockLines = blockToCode(block, 0, indent);
        lines.push(...blockLines);
    }

    // Ensure file ends with newline
    return lines.join('\n') + '\n';
}

/**
 * Convert a single block to code lines
 */
function blockToCode(block: Block, level: number, indent: string): string[] {
    const prefix = indent.repeat(level);
    const lines: string[] = [];

    switch (block.type) {
        case 'import':
            lines.push(...generateImport(block, prefix));
            break;
        case 'fromImport':
            lines.push(...generateFromImport(block, prefix));
            break;
        case 'assign':
            lines.push(...generateAssign(block, prefix));
            break;
        case 'augAssign':
            lines.push(...generateAugAssign(block, prefix));
            break;
        case 'annotatedAssign':
            lines.push(...generateAnnotatedAssign(block, prefix));
            break;
        case 'function':
        case 'asyncFunction':
            lines.push(...generateFunction(block, level, indent));
            break;
        case 'class':
            lines.push(...generateClass(block, level, indent));
            break;
        case 'if':
            lines.push(...generateIf(block, level, indent));
            break;
        case 'for':
            lines.push(...generateFor(block, level, indent));
            break;
        case 'while':
            lines.push(...generateWhile(block, level, indent));
            break;
        case 'try':
            lines.push(...generateTry(block, level, indent));
            break;
        case 'with':
            lines.push(...generateWith(block, level, indent));
            break;
        case 'return':
            lines.push(...generateReturn(block, prefix));
            break;
        case 'yield':
            lines.push(...generateYield(block, prefix));
            break;
        case 'raise':
            lines.push(...generateRaise(block, prefix));
            break;
        case 'assert':
            lines.push(...generateAssert(block, prefix));
            break;
        case 'pass':
            lines.push(`${prefix}pass`);
            break;
        case 'break':
            lines.push(`${prefix}break`);
            break;
        case 'continue':
            lines.push(`${prefix}continue`);
            break;
        case 'comment':
            lines.push(...generateComment(block, prefix));
            break;
        case 'expression':
            lines.push(...generateExpression(block, prefix));
            break;
        case 'error':
            // Skip error blocks or output as comment
            lines.push(`${prefix}# ERROR: ${block.metadata.error || 'Unknown error'}`);
            break;
        default:
            // Fall back to raw content
            lines.push(`${prefix}${block.content.raw}`);
    }

    return lines;
}

/**
 * Generate children block code
 */
function generateChildren(
    children: Block[] | undefined,
    level: number,
    indent: string
): string[] {
    if (!children || children.length === 0) {
        return [indent.repeat(level + 1) + 'pass'];
    }

    const lines: string[] = [];
    for (const child of children) {
        lines.push(...blockToCode(child, level + 1, indent));
    }
    return lines;
}

// Code generators for each block type

function generateImport(block: Block, prefix: string): string[] {
    const modules = getFieldValue(block, 'modules') || 'module';
    return [`${prefix}import ${modules}`];
}

function generateFromImport(block: Block, prefix: string): string[] {
    const module = getFieldValue(block, 'module') || 'module';
    const names = getFieldValue(block, 'names') || '*';
    return [`${prefix}from ${module} import ${names}`];
}

function generateAssign(block: Block, prefix: string): string[] {
    const targets = getFieldValue(block, 'targets') || 'x';
    const value = getFieldValue(block, 'value') || 'None';
    return [`${prefix}${targets} = ${value}`];
}

function generateAugAssign(block: Block, prefix: string): string[] {
    const target = getFieldValue(block, 'target') || 'x';
    const op = getFieldValue(block, 'operator') || '+';
    const value = getFieldValue(block, 'value') || '1';
    return [`${prefix}${target} ${op}= ${value}`];
}

function generateAnnotatedAssign(block: Block, prefix: string): string[] {
    const target = getFieldValue(block, 'target') || 'x';
    const type = getFieldValue(block, 'type') || 'Any';
    const value = getFieldValue(block, 'value');

    if (value) {
        return [`${prefix}${target}: ${type} = ${value}`];
    }
    return [`${prefix}${target}: ${type}`];
}

function generateFunction(block: Block, level: number, indent: string): string[] {
    const prefix = indent.repeat(level);
    const name = getFieldValue(block, 'name') || 'function';
    const params = getFieldValue(block, 'params') || '';
    const returnType = getFieldValue(block, 'returnType');

    const isAsync = block.type === 'asyncFunction';
    const keyword = isAsync ? 'async def' : 'def';

    let signature = `${prefix}${keyword} ${name}(${params})`;
    if (returnType) {
        signature += ` -> ${returnType}`;
    }
    signature += ':';

    const lines = [signature];
    lines.push(...generateChildren(block.children, level, indent));

    return lines;
}

function generateClass(block: Block, level: number, indent: string): string[] {
    const prefix = indent.repeat(level);
    const name = getFieldValue(block, 'name') || 'Class';
    const bases = getFieldValue(block, 'bases');

    let signature = `${prefix}class ${name}`;
    if (bases) {
        signature += `(${bases})`;
    }
    signature += ':';

    const lines = [signature];
    lines.push(...generateChildren(block.children, level, indent));

    return lines;
}

function generateIf(block: Block, level: number, indent: string): string[] {
    const prefix = indent.repeat(level);
    const condition = getFieldValue(block, 'condition') || 'True';

    const lines = [`${prefix}if ${condition}:`];
    lines.push(...generateChildren(block.children, level, indent));

    // Process attachments (elif/else)
    for (const attachment of (block.attachments || [])) {
        if (attachment.type === 'elif') {
            const elifCondition = getFieldValue(attachment, 'condition') || 'True';
            lines.push(`${prefix}elif ${elifCondition}:`);
            lines.push(...generateChildren(attachment.children, level, indent));

            // Recursively handle nested attachments
            for (const subAttachment of (attachment.attachments || [])) {
                lines.push(...generateAttachment(subAttachment, level, indent));
            }
        } else if (attachment.type === 'else') {
            lines.push(`${prefix}else:`);
            lines.push(...generateChildren(attachment.children, level, indent));
        }
    }

    return lines;
}

function generateAttachment(attachment: Block, level: number, indent: string): string[] {
    const prefix = indent.repeat(level);
    const lines: string[] = [];

    if (attachment.type === 'elif') {
        const condition = getFieldValue(attachment, 'condition') || 'True';
        lines.push(`${prefix}elif ${condition}:`);
        lines.push(...generateChildren(attachment.children, level, indent));

        for (const sub of (attachment.attachments || [])) {
            lines.push(...generateAttachment(sub, level, indent));
        }
    } else if (attachment.type === 'else') {
        lines.push(`${prefix}else:`);
        lines.push(...generateChildren(attachment.children, level, indent));
    } else if (attachment.type === 'except') {
        const type = getFieldValue(attachment, 'type');
        const name = getFieldValue(attachment, 'name');
        let exceptLine = `${prefix}except`;
        if (type) {
            exceptLine += ` ${type}`;
            if (name) {
                exceptLine += ` as ${name}`;
            }
        }
        exceptLine += ':';
        lines.push(exceptLine);
        lines.push(...generateChildren(attachment.children, level, indent));
    } else if (attachment.type === 'finally') {
        lines.push(`${prefix}finally:`);
        lines.push(...generateChildren(attachment.children, level, indent));
    }

    return lines;
}

function generateFor(block: Block, level: number, indent: string): string[] {
    const prefix = indent.repeat(level);
    const target = getFieldValue(block, 'target') || 'item';
    const iterable = getFieldValue(block, 'iterable') || 'items';

    const lines = [`${prefix}for ${target} in ${iterable}:`];
    lines.push(...generateChildren(block.children, level, indent));

    // Process else attachment
    for (const attachment of (block.attachments || [])) {
        if (attachment.type === 'else') {
            lines.push(`${prefix}else:`);
            lines.push(...generateChildren(attachment.children, level, indent));
        }
    }

    return lines;
}

function generateWhile(block: Block, level: number, indent: string): string[] {
    const prefix = indent.repeat(level);
    const condition = getFieldValue(block, 'condition') || 'True';

    const lines = [`${prefix}while ${condition}:`];
    lines.push(...generateChildren(block.children, level, indent));

    // Process else attachment
    for (const attachment of (block.attachments || [])) {
        if (attachment.type === 'else') {
            lines.push(`${prefix}else:`);
            lines.push(...generateChildren(attachment.children, level, indent));
        }
    }

    return lines;
}

function generateTry(block: Block, level: number, indent: string): string[] {
    const prefix = indent.repeat(level);

    const lines = [`${prefix}try:`];
    lines.push(...generateChildren(block.children, level, indent));

    // Process attachments (except/else/finally)
    for (const attachment of (block.attachments || [])) {
        lines.push(...generateAttachment(attachment, level, indent));
    }

    return lines;
}

function generateWith(block: Block, level: number, indent: string): string[] {
    const prefix = indent.repeat(level);
    const items = getFieldValue(block, 'items') || 'context';

    const lines = [`${prefix}with ${items}:`];
    lines.push(...generateChildren(block.children, level, indent));

    return lines;
}

function generateReturn(block: Block, prefix: string): string[] {
    const value = getFieldValue(block, 'value');
    if (value) {
        return [`${prefix}return ${value}`];
    }
    return [`${prefix}return`];
}

function generateYield(block: Block, prefix: string): string[] {
    const value = getFieldValue(block, 'value');
    const isFrom = getFieldValue(block, 'isFrom') === 'true';

    if (isFrom && value) {
        return [`${prefix}yield from ${value}`];
    } else if (value) {
        return [`${prefix}yield ${value}`];
    }
    return [`${prefix}yield`];
}

function generateRaise(block: Block, prefix: string): string[] {
    const exception = getFieldValue(block, 'exception');
    const cause = getFieldValue(block, 'cause');

    if (exception && cause) {
        return [`${prefix}raise ${exception} from ${cause}`];
    } else if (exception) {
        return [`${prefix}raise ${exception}`];
    }
    return [`${prefix}raise`];
}

function generateAssert(block: Block, prefix: string): string[] {
    const condition = getFieldValue(block, 'condition') || 'True';
    const message = getFieldValue(block, 'message');

    if (message) {
        return [`${prefix}assert ${condition}, ${message}`];
    }
    return [`${prefix}assert ${condition}`];
}

function generateComment(block: Block, prefix: string): string[] {
    const text = getFieldValue(block, 'text') || '';
    return [`${prefix}# ${text}`];
}

function generateExpression(block: Block, prefix: string): string[] {
    const expr = getFieldValue(block, 'expression') || block.content.raw;
    return [`${prefix}${expr}`];
}

// Helper to get field value
function getFieldValue(block: Block, fieldId: string): string {
    const field = block.content.editable.find(f => f.id === fieldId);
    return field?.value || '';
}
