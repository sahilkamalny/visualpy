/**
 * AST type definitions for Python parsing
 */

export interface ASTNode {
    type: string;
    lineno: number | null;
    col_offset: number | null;
    end_lineno: number | null;
    end_col_offset: number | null;
    source?: string;
    [key: string]: any;
}

export interface ASTModule extends ASTNode {
    type: 'Module';
    body: ASTNode[];
}

export interface ASTImport extends ASTNode {
    type: 'Import';
    names: Array<{ name: string; asname: string | null }>;
}

export interface ASTImportFrom extends ASTNode {
    type: 'ImportFrom';
    module: string | null;
    names: Array<{ name: string; asname: string | null }>;
    level: number;
}

export interface ASTAssign extends ASTNode {
    type: 'Assign';
    targets: ASTNode[];
    value: ASTNode;
}

export interface ASTAugAssign extends ASTNode {
    type: 'AugAssign';
    target: ASTNode;
    op: ASTNode;
    value: ASTNode;
}

export interface ASTAnnAssign extends ASTNode {
    type: 'AnnAssign';
    target: ASTNode;
    annotation: ASTNode;
    value: ASTNode | null;
    simple: number;
}

export interface ASTFunctionDef extends ASTNode {
    type: 'FunctionDef' | 'AsyncFunctionDef';
    name: string;
    args: {
        args: Array<{ arg: string; annotation: ASTNode | null }>;
        defaults: ASTNode[];
        kwonlyargs: Array<{ arg: string; annotation: ASTNode | null }>;
        kw_defaults: (ASTNode | null)[];
        kwarg: { arg: string; annotation: ASTNode | null } | null;
        vararg: { arg: string; annotation: ASTNode | null } | null;
        posonlyargs: Array<{ arg: string; annotation: ASTNode | null }>;
    };
    body: ASTNode[];
    decorator_list: ASTNode[];
    returns: ASTNode | null;
}

export interface ASTClassDef extends ASTNode {
    type: 'ClassDef';
    name: string;
    bases: ASTNode[];
    keywords: Array<{ arg: string | null; value: ASTNode }>;
    body: ASTNode[];
    decorator_list: ASTNode[];
}

export interface ASTIf extends ASTNode {
    type: 'If';
    test: ASTNode;
    body: ASTNode[];
    orelse: ASTNode[];
}

export interface ASTFor extends ASTNode {
    type: 'For' | 'AsyncFor';
    target: ASTNode;
    iter: ASTNode;
    body: ASTNode[];
    orelse: ASTNode[];
}

export interface ASTWhile extends ASTNode {
    type: 'While';
    test: ASTNode;
    body: ASTNode[];
    orelse: ASTNode[];
}

export interface ASTTry extends ASTNode {
    type: 'Try';
    body: ASTNode[];
    handlers: Array<{
        type: string | null;
        name: string | null;
        body: ASTNode[];
    }>;
    orelse: ASTNode[];
    finalbody: ASTNode[];
}

export interface ASTWith extends ASTNode {
    type: 'With' | 'AsyncWith';
    items: Array<{
        context_expr: ASTNode;
        optional_vars: ASTNode | null;
    }>;
    body: ASTNode[];
}

export interface ASTReturn extends ASTNode {
    type: 'Return';
    value: ASTNode | null;
}

export interface ASTRaise extends ASTNode {
    type: 'Raise';
    exc: ASTNode | null;
    cause: ASTNode | null;
}

export interface ASTExpr extends ASTNode {
    type: 'Expr';
    value: ASTNode;
}

export interface CommentInfo {
    line: number;
    column: number;
    text: string;
    inline: boolean;
}

export interface ParseResult {
    success: boolean;
    ast: ASTModule | null;
    comments: CommentInfo[];
    errors: Array<{
        message: string;
        lineno: number | null;
        col_offset: number | null;
    }>;
}
