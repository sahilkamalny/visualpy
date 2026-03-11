import { ASTNode, ASTModule, ParseResult, CommentInfo } from '../types/ast';
import { Block, BlockType, BlockCategory, BLOCK_TYPE_CATEGORY } from '../types/blocks';
import { generateId } from '../utils/id';

/**
 * Convert AST to Block tree
 */
export function astToBlocks(parseResult: ParseResult): Block[] {
    if (!parseResult.success || !parseResult.ast) {
        return parseResult.errors.map(err => createErrorBlock(err.message, err.lineno || 1));
    }

    const module = parseResult.ast as ASTModule;
    const blocks: Block[] = [];

    // Associate comments with nodes
    const commentsByLine = new Map<number, CommentInfo[]>();
    for (const comment of parseResult.comments) {
        if (!commentsByLine.has(comment.line)) {
            commentsByLine.set(comment.line, []);
        }
        commentsByLine.get(comment.line)!.push(comment);
    }

    // Process each body statement
    blocks.push(...processBodyWithComments(module.body, commentsByLine, 0));

    return blocks;
}

/**
 * Process a list of body nodes and insert comments where appropriate
 */
/**
 * Process a list of body nodes and insert comments where appropriate
 */
function processBodyWithComments(
    nodes: ASTNode[],
    commentsByLine: Map<number, CommentInfo[]>,
    initialStartLine?: number
): Block[] {
    const blocks: Block[] = [];

    // If initialStartLine is provided, use it.
    // If not, and we have nodes, infer start from the first node (local scope).
    // Otherwise (no nodes, no start line), default to 0 (start of file/empty block).
    let lastEndLine: number;
    if (initialStartLine !== undefined) {
        lastEndLine = initialStartLine;
    } else if (nodes.length > 0 && nodes[0].lineno) {
        lastEndLine = nodes[0].lineno - 1;
    } else {
        lastEndLine = 0;
    }

    for (const node of nodes) {
        const nodeLine = node.lineno || 1;

        // Add standalone comments appearing before this node
        if (nodeLine > lastEndLine) {
            for (let line = lastEndLine + 1; line < nodeLine; line++) {
                const lineComments = commentsByLine.get(line);
                if (lineComments) {
                    for (const comment of lineComments) {
                        if (!comment.inline) {
                            blocks.push(createCommentBlock(comment));
                        }
                    }
                }
            }
        }

        const block = nodeToBlock(node, commentsByLine);
        if (block) {
            blocks.push(block);
        }
        lastEndLine = Math.max(lastEndLine, node.end_lineno || nodeLine);
    }

    // If this is the top-level (initialStartLine undefined) or explicit request, 
    // and we have remaining comments (e.g. file ends with comments, or file is ONLY comments),
    // we should try to include them.
    // Since we don't know the exact end of file here, we can heuristically check 
    // if there are more comments in the map greater than lastEndLine.
    // However, for nested blocks, grabbing "everything after" is dangerous as it might belong to outer scope.
    // But for the CASE where nodes is empty (e.g. empty file with comments), we MUST process them.
    if (nodes.length === 0 && initialStartLine === undefined) {
        // Scan all comments since we have no nodes to bound them
        const sortedLines = Array.from(commentsByLine.keys()).sort((a, b) => a - b);
        for (const line of sortedLines) {
            if (line > lastEndLine) {
                const lineComments = commentsByLine.get(line);
                if (lineComments) {
                    for (const comment of lineComments) {
                        if (!comment.inline) {
                            blocks.push(createCommentBlock(comment));
                        }
                    }
                }
            }
        }
    }

    return blocks;
}

/**
 * Convert a single AST node to a Block
 */
function nodeToBlock(node: ASTNode, comments: Map<number, CommentInfo[]>): Block | null {
    const nodeComments = getNodeComments(node, comments);

    switch (node.type) {
        case 'Import':
            return createImportBlock(node, nodeComments);
        case 'ImportFrom':
            return createFromImportBlock(node, nodeComments);
        case 'Assign':
            return createAssignBlock(node, nodeComments);
        case 'AugAssign':
            return createAugAssignBlock(node, nodeComments);
        case 'AnnAssign':
            return createAnnotatedAssignBlock(node, nodeComments);
        case 'FunctionDef':
            return createFunctionBlock(node, comments, nodeComments, false);
        case 'AsyncFunctionDef':
            return createFunctionBlock(node, comments, nodeComments, true);
        case 'ClassDef':
            return createClassBlock(node, comments, nodeComments);
        case 'If':
            return createIfBlock(node, comments, nodeComments);
        case 'For':
            return createForBlock(node, comments, nodeComments, false);
        case 'AsyncFor':
            return createForBlock(node, comments, nodeComments, true);
        case 'While':
            return createWhileBlock(node, comments, nodeComments);
        case 'Try':
            return createTryBlock(node, comments, nodeComments);
        case 'With':
            return createWithBlock(node, comments, nodeComments, false);
        case 'AsyncWith':
            return createWithBlock(node, comments, nodeComments, true);
        case 'Return':
            return createReturnBlock(node, nodeComments);
        case 'Yield':
        case 'YieldFrom':
            return createYieldBlock(node, nodeComments);
        case 'Raise':
            return createRaiseBlock(node, nodeComments);
        case 'Assert':
            return createAssertBlock(node, nodeComments);
        case 'Pass':
            return createPassBlock(node, nodeComments);
        case 'Break':
            return createBreakBlock(node, nodeComments);
        case 'Continue':
            return createContinueBlock(node, nodeComments);
        case 'Expr':
            return createExpressionBlock(node, nodeComments);
        default:
            return createExpressionBlock(node, nodeComments);
    }
}

/**
 * Get comments associated with a node
 */
function getNodeComments(node: ASTNode, comments: Map<number, CommentInfo[]>): CommentInfo[] {
    const result: CommentInfo[] = [];
    const startLine = node.lineno || 1;
    const endLine = node.end_lineno || startLine;

    for (let line = startLine; line <= endLine; line++) {
        const lineComments = comments.get(line);
        if (lineComments) {
            result.push(...lineComments.filter(c => c.inline));
        }
    }

    return result;
}

/**
 * Create base block structure
 */
function createBlock(
    type: BlockType,
    raw: string,
    node: ASTNode,
    comments: CommentInfo[]
): Block {
    return {
        id: generateId(),
        type,
        category: BLOCK_TYPE_CATEGORY[type],
        content: {
            raw,
            editable: []
        },
        metadata: {
            sourceRange: {
                startLine: node.lineno || 1,
                startColumn: node.col_offset || 0,
                endLine: node.end_lineno || node.lineno || 1,
                endColumn: node.end_col_offset || 0
            },
            comments,
            collapsed: false
        }
    };
}

// Block creation functions

function createErrorBlock(message: string, line: number): Block {
    return {
        id: generateId(),
        type: 'error',
        category: 'misc',
        content: {
            raw: message,
            editable: [{
                id: 'message',
                label: 'Error',
                value: message
            }]
        },
        metadata: {
            sourceRange: { startLine: line, startColumn: 0, endLine: line, endColumn: 0 },
            comments: [],
            collapsed: false,
            error: message
        }
    };
}

function createCommentBlock(comment: CommentInfo): Block {
    return {
        id: generateId(),
        type: 'comment',
        category: 'misc',
        content: {
            raw: `# ${comment.text}`,
            editable: [{
                id: 'text',
                label: 'Comment',
                value: comment.text
            }]
        },
        metadata: {
            sourceRange: {
                startLine: comment.line,
                startColumn: comment.column,
                endLine: comment.line,
                endColumn: comment.column + comment.text.length + 2
            },
            comments: [],
            collapsed: false
        }
    };
}

function createImportBlock(node: ASTNode, comments: CommentInfo[]): Block {
    const names = node.names || [];
    const modules = names.map((n: any) =>
        n.asname ? `${n.name} as ${n.asname}` : n.name
    ).join(', ');

    const block = createBlock('import', node.source || `import ${modules}`, node, comments);
    block.content.editable = [{
        id: 'modules',
        label: 'Modules',
        value: modules
    }];
    return block;
}

function createFromImportBlock(node: ASTNode, comments: CommentInfo[]): Block {
    const module = node.module || '';
    const names = (node.names || []).map((n: any) =>
        n.asname ? `${n.name} as ${n.asname}` : n.name
    ).join(', ');
    const level = '.'.repeat(node.level || 0);

    const block = createBlock('fromImport', node.source || `from ${level}${module} import ${names}`, node, comments);
    block.content.editable = [
        { id: 'module', label: 'Module', value: `${level}${module}` },
        { id: 'names', label: 'Names', value: names }
    ];
    return block;
}

function createAssignBlock(node: ASTNode, comments: CommentInfo[]): Block {
    const targets = (node.targets || []).map((t: any) => t.source || t.id || 'target').join(', ');
    const value = node.value?.source || 'value';

    const block = createBlock('assign', node.source || `${targets} = ${value}`, node, comments);
    block.content.editable = [
        { id: 'targets', label: 'Variables', value: targets },
        { id: 'value', label: 'Value', value: value }
    ];
    return block;
}

function createAugAssignBlock(node: ASTNode, comments: CommentInfo[]): Block {
    const target = node.target?.source || node.target?.id || 'target';
    const op = getOperatorSymbol(node.op);
    const value = node.value?.source || 'value';

    const block = createBlock('augAssign', node.source || `${target} ${op}= ${value}`, node, comments);
    block.content.editable = [
        { id: 'target', label: 'Variable', value: target },
        { id: 'operator', label: 'Operator', value: op },
        { id: 'value', label: 'Value', value: value }
    ];
    return block;
}

function createAnnotatedAssignBlock(node: ASTNode, comments: CommentInfo[]): Block {
    const target = node.target?.source || node.target?.id || 'target';
    const annotation = node.annotation?.source || 'type';
    const value = node.value?.source || '';

    const raw = value
        ? `${target}: ${annotation} = ${value}`
        : `${target}: ${annotation}`;

    const block = createBlock('annotatedAssign', node.source || raw, node, comments);
    block.content.editable = [
        { id: 'target', label: 'Variable', value: target },
        { id: 'type', label: 'Type', value: annotation },
        { id: 'value', label: 'Value', value: value }
    ];
    return block;
}

function createFunctionBlock(
    node: ASTNode,
    comments: Map<number, CommentInfo[]>,
    nodeComments: CommentInfo[],
    isAsync: boolean
): Block {
    const name = node.name || 'function';
    const args = formatFunctionArgs(node.args);
    const returnType = node.returns?.source || '';

    const prefix = isAsync ? 'async def' : 'def';
    const signature = returnType
        ? `${prefix} ${name}(${args}) -> ${returnType}:`
        : `${prefix} ${name}(${args}):`;

    const block = createBlock(
        isAsync ? 'asyncFunction' : 'function',
        node.source || signature,
        node,
        nodeComments
    );

    block.content.editable = [
        { id: 'name', label: 'Name', value: name },
        { id: 'params', label: 'Parameters', value: args },
        { id: 'returnType', label: 'Return Type', value: returnType }
    ];

    // Process body
    block.children = processBodyWithComments(node.body || [], comments, node.lineno || undefined);

    return block;
}

function createClassBlock(
    node: ASTNode,
    comments: Map<number, CommentInfo[]>,
    nodeComments: CommentInfo[]
): Block {
    const name = node.name || 'Class';
    const bases = (node.bases || []).map((b: any) => b.source || b.id || 'base').join(', ');

    const signature = bases ? `class ${name}(${bases}):` : `class ${name}:`;

    const block = createBlock('class', node.source || signature, node, nodeComments);
    block.content.editable = [
        { id: 'name', label: 'Name', value: name },
        { id: 'bases', label: 'Bases', value: bases }
    ];

    // Process body
    block.children = processBodyWithComments(node.body || [], comments, node.lineno || undefined);

    return block;
}

function createIfBlock(
    node: ASTNode,
    comments: Map<number, CommentInfo[]>,
    nodeComments: CommentInfo[]
): Block {
    const condition = node.test?.source || 'condition';

    const block = createBlock('if', node.source || `if ${condition}:`, node, nodeComments);
    block.content.editable = [
        { id: 'condition', label: 'Condition', value: condition }
    ];

    // Process if body
    block.children = processBodyWithComments(node.body || [], comments, node.lineno || undefined);

    // Process elif/else (orelse)
    block.attachments = [];
    const orelse = node.orelse || [];

    if (orelse.length === 1 && orelse[0].type === 'If') {
        // This is an elif
        const elifNode = orelse[0];
        const elifBlock = createElifBlock(elifNode, comments);
        block.attachments.push(elifBlock);
    } else if (orelse.length > 0) {
        // This is an else
        const elseBlock = createElseBlock(orelse, comments, node);
        block.attachments.push(elseBlock);
    }

    return block;
}

function createElifBlock(node: ASTNode, comments: Map<number, CommentInfo[]>): Block {
    const condition = node.test?.source || 'condition';
    const nodeComments = getNodeComments(node, comments);

    const block = createBlock('elif', `elif ${condition}:`, node, nodeComments);
    block.content.editable = [
        { id: 'condition', label: 'Condition', value: condition }
    ];

    // Process body
    block.children = processBodyWithComments(node.body || [], comments, node.lineno || undefined);

    // Process further elif/else
    block.attachments = [];
    const orelse = node.orelse || [];

    if (orelse.length === 1 && orelse[0].type === 'If') {
        const elifBlock = createElifBlock(orelse[0], comments);
        block.attachments.push(elifBlock);
    } else if (orelse.length > 0) {
        const elseBlock = createElseBlock(orelse, comments, node);
        block.attachments.push(elseBlock);
    }

    return block;
}

function createElseBlock(
    body: ASTNode[],
    comments: Map<number, CommentInfo[]>,
    parentNode: ASTNode
): Block {
    const block: Block = {
        id: generateId(),
        type: 'else',
        category: 'control',
        content: {
            raw: 'else:',
            editable: []
        },
        metadata: {
            sourceRange: {
                startLine: body[0]?.lineno || parentNode.end_lineno || 1,
                startColumn: 0,
                endLine: body[body.length - 1]?.end_lineno || parentNode.end_lineno || 1,
                endColumn: body[body.length - 1]?.end_col_offset || 0
            },
            comments: [],
            collapsed: false
        },
        children: processBodyWithComments(body, comments)
    };

    return block;
}

function createForBlock(
    node: ASTNode,
    comments: Map<number, CommentInfo[]>,
    nodeComments: CommentInfo[],
    isAsync: boolean
): Block {
    const target = node.target?.source || 'item';
    const iter = node.iter?.source || 'iterable';

    const prefix = isAsync ? 'async for' : 'for';
    const block = createBlock('for', node.source || `${prefix} ${target} in ${iter}:`, node, nodeComments);
    block.content.editable = [
        { id: 'target', label: 'Variable', value: target },
        { id: 'iterable', label: 'Iterable', value: iter }
    ];

    // Process body
    block.children = processBodyWithComments(node.body || [], comments, node.lineno || undefined);

    // Process else
    block.attachments = [];
    const orelse = node.orelse || [];
    if (orelse.length > 0) {
        const elseBlock = createElseBlock(orelse, comments, node);
        block.attachments.push(elseBlock);
    }

    return block;
}

function createWhileBlock(
    node: ASTNode,
    comments: Map<number, CommentInfo[]>,
    nodeComments: CommentInfo[]
): Block {
    const condition = node.test?.source || 'condition';

    const block = createBlock('while', node.source || `while ${condition}:`, node, nodeComments);
    block.content.editable = [
        { id: 'condition', label: 'Condition', value: condition }
    ];

    // Process body
    block.children = processBodyWithComments(node.body || [], comments, node.lineno || undefined);

    // Process else
    block.attachments = [];
    const orelse = node.orelse || [];
    if (orelse.length > 0) {
        const elseBlock = createElseBlock(orelse, comments, node);
        block.attachments.push(elseBlock);
    }

    return block;
}

function createTryBlock(
    node: ASTNode,
    comments: Map<number, CommentInfo[]>,
    nodeComments: CommentInfo[]
): Block {
    const block = createBlock('try', 'try:', node, nodeComments);

    // Process try body
    block.children = processBodyWithComments(node.body || [], comments, node.lineno || undefined);

    // Process except handlers
    block.attachments = [];
    for (const handler of (node.handlers || [])) {
        const exceptBlock = createExceptBlock(handler, comments);
        block.attachments.push(exceptBlock);
    }

    // Process else
    const orelse = node.orelse || [];
    if (orelse.length > 0) {
        const elseBlock = createElseBlock(orelse, comments, node);
        block.attachments.push(elseBlock);
    }

    // Process finally
    const finalbody = node.finalbody || [];
    if (finalbody.length > 0) {
        const finallyBlock = createFinallyBlock(finalbody, comments, node);
        block.attachments.push(finallyBlock);
    }

    return block;
}

function createExceptBlock(handler: any, comments: Map<number, CommentInfo[]>): Block {
    const type = handler.type?.source || '';
    const name = handler.name || '';
    const nodeComments = getNodeComments(handler, comments);

    let raw = 'except';
    if (type) {
        raw += ` ${type}`;
        if (name) {
            raw += ` as ${name}`;
        }
    }
    raw += ':';

    const block: Block = {
        id: generateId(),
        type: 'except',
        category: 'exceptions',
        content: {
            raw,
            editable: [
                { id: 'type', label: 'Exception Type', value: type },
                { id: 'name', label: 'As Name', value: name }
            ]
        },
        metadata: {
            sourceRange: {
                startLine: handler.lineno || 1,
                startColumn: handler.col_offset || 0,
                endLine: handler.end_lineno || handler.lineno || 1,
                endColumn: handler.end_col_offset || 0
            },
            comments: nodeComments,
            collapsed: false
        },
        children: processBodyWithComments(handler.body || [], comments, handler.lineno)
    };

    return block;
}

function createFinallyBlock(
    body: ASTNode[],
    comments: Map<number, CommentInfo[]>,
    parentNode: ASTNode
): Block {
    const block: Block = {
        id: generateId(),
        type: 'finally',
        category: 'exceptions',
        content: {
            raw: 'finally:',
            editable: []
        },
        metadata: {
            sourceRange: {
                startLine: body[0]?.lineno || parentNode.end_lineno || 1,
                startColumn: 0,
                endLine: body[body.length - 1]?.end_lineno || parentNode.end_lineno || 1,
                endColumn: body[body.length - 1]?.end_col_offset || 0
            },
            comments: [],
            collapsed: false
        },
        children: processBodyWithComments(body, comments)
    };

    return block;
}

function createWithBlock(
    node: ASTNode,
    comments: Map<number, CommentInfo[]>,
    nodeComments: CommentInfo[],
    isAsync: boolean
): Block {
    const items = (node.items || []).map((item: any) => {
        const context = item.context_expr?.source || 'context';
        const vars = item.optional_vars?.source || '';
        return vars ? `${context} as ${vars}` : context;
    }).join(', ');

    const prefix = isAsync ? 'async with' : 'with';
    const block = createBlock('with', node.source || `${prefix} ${items}:`, node, nodeComments);
    block.content.editable = [
        { id: 'items', label: 'Context Managers', value: items }
    ];

    // Process body
    block.children = processBodyWithComments(node.body || [], comments, node.lineno || undefined);

    return block;
}

function createReturnBlock(node: ASTNode, comments: CommentInfo[]): Block {
    const value = node.value?.source || '';
    const raw = value ? `return ${value}` : 'return';

    const block = createBlock('return', node.source || raw, node, comments);
    block.content.editable = [
        { id: 'value', label: 'Value', value: value }
    ];
    return block;
}

function createYieldBlock(node: ASTNode, comments: CommentInfo[]): Block {
    const value = node.value?.source || '';
    const isYieldFrom = node.type === 'YieldFrom';
    const raw = isYieldFrom
        ? `yield from ${value}`
        : (value ? `yield ${value}` : 'yield');

    const block = createBlock('yield', node.source || raw, node, comments);
    block.content.editable = [
        { id: 'value', label: 'Value', value: value },
        { id: 'isFrom', label: 'Is Yield From', value: isYieldFrom ? 'true' : 'false' }
    ];
    return block;
}

function createRaiseBlock(node: ASTNode, comments: CommentInfo[]): Block {
    const exc = node.exc?.source || '';
    const cause = node.cause?.source || '';

    let raw = 'raise';
    if (exc) {
        raw += ` ${exc}`;
        if (cause) {
            raw += ` from ${cause}`;
        }
    }

    const block = createBlock('raise', node.source || raw, node, comments);
    block.content.editable = [
        { id: 'exception', label: 'Exception', value: exc },
        { id: 'cause', label: 'From', value: cause }
    ];
    return block;
}

function createAssertBlock(node: ASTNode, comments: CommentInfo[]): Block {
    const test = node.test?.source || 'condition';
    const msg = node.msg?.source || '';

    const raw = msg ? `assert ${test}, ${msg}` : `assert ${test}`;

    const block = createBlock('assert', node.source || raw, node, comments);
    block.content.editable = [
        { id: 'condition', label: 'Condition', value: test },
        { id: 'message', label: 'Message', value: msg }
    ];
    return block;
}

function createPassBlock(node: ASTNode, comments: CommentInfo[]): Block {
    return createBlock('pass', 'pass', node, comments);
}

function createBreakBlock(node: ASTNode, comments: CommentInfo[]): Block {
    return createBlock('break', 'break', node, comments);
}

function createContinueBlock(node: ASTNode, comments: CommentInfo[]): Block {
    return createBlock('continue', 'continue', node, comments);
}

function createExpressionBlock(node: ASTNode, comments: CommentInfo[]): Block {
    const value = node.type === 'Expr'
        ? (node.value?.source || 'expression')
        : (node.source || 'expression');

    const block = createBlock('expression', value, node, comments);
    block.content.editable = [
        { id: 'expression', label: 'Expression', value: value }
    ];
    return block;
}

// Helper functions

function formatFunctionArgs(args: any): string {
    if (!args) return '';

    const parts: string[] = [];

    // Positional-only args (Python 3.8+)
    for (const arg of (args.posonlyargs || [])) {
        parts.push(formatArg(arg));
    }

    if (args.posonlyargs?.length > 0) {
        parts.push('/');
    }

    // Regular args
    const regularArgs = args.args || [];
    const defaults = args.defaults || [];
    const defaultOffset = regularArgs.length - defaults.length;

    for (let i = 0; i < regularArgs.length; i++) {
        const arg = regularArgs[i];
        const defaultIdx = i - defaultOffset;
        if (defaultIdx >= 0 && defaults[defaultIdx]) {
            parts.push(`${formatArg(arg)}=${defaults[defaultIdx].source || 'default'}`);
        } else {
            parts.push(formatArg(arg));
        }
    }

    // *args
    if (args.vararg) {
        parts.push(`*${formatArg(args.vararg)}`);
    } else if (args.kwonlyargs?.length > 0) {
        parts.push('*');
    }

    // Keyword-only args
    const kwDefaults = args.kw_defaults || [];
    for (let i = 0; i < (args.kwonlyargs || []).length; i++) {
        const arg = args.kwonlyargs[i];
        const def = kwDefaults[i];
        if (def) {
            parts.push(`${formatArg(arg)}=${def.source || 'default'}`);
        } else {
            parts.push(formatArg(arg));
        }
    }

    // **kwargs
    if (args.kwarg) {
        parts.push(`**${formatArg(args.kwarg)}`);
    }

    return parts.join(', ');
}

function formatArg(arg: any): string {
    if (!arg) return '';
    const name = arg.arg || '';
    const annotation = arg.annotation?.source || '';
    return annotation ? `${name}: ${annotation}` : name;
}

function getOperatorSymbol(op: any): string {
    if (!op) return '?';
    const opType = op.type || op;
    const operators: Record<string, string> = {
        'Add': '+',
        'Sub': '-',
        'Mult': '*',
        'Div': '/',
        'FloorDiv': '//',
        'Mod': '%',
        'Pow': '**',
        'LShift': '<<',
        'RShift': '>>',
        'BitOr': '|',
        'BitXor': '^',
        'BitAnd': '&',
        'MatMult': '@'
    };
    return operators[opType] || '?';
}
