import type { Block } from './types';

const DEFAULT_SUGGESTION_LIMIT = 80;

const PYTHON_RESERVED = new Set([
    'False',
    'None',
    'True',
    'and',
    'as',
    'assert',
    'async',
    'await',
    'break',
    'case',
    'class',
    'continue',
    'def',
    'del',
    'elif',
    'else',
    'except',
    'finally',
    'for',
    'from',
    'global',
    'if',
    'import',
    'in',
    'is',
    'lambda',
    'match',
    'nonlocal',
    'not',
    'or',
    'pass',
    'raise',
    'return',
    'try',
    'while',
    'with',
    'yield',
]);

const BRANCHING_BLOCK_TYPES = new Set<Block['type']>([
    'if',
    'elif',
    'for',
    'while',
    'try',
]);

interface ScopeFrame {
    ordered: string[];
    seen: Set<string>;
}

function createScopeFrame(initial: string[] = []): ScopeFrame {
    const frame: ScopeFrame = {
        ordered: [],
        seen: new Set<string>(),
    };
    addSymbols(frame, initial);
    return frame;
}

function cloneScopeChain(scopeChain: ScopeFrame[]): ScopeFrame[] {
    return scopeChain.map((scope) => createScopeFrame(scope.ordered));
}

function currentScope(scopeChain: ScopeFrame[]): ScopeFrame {
    return scopeChain[scopeChain.length - 1];
}

function normalizeIdentifier(value: string): string {
    return value.trim();
}

function addSymbols(scope: ScopeFrame, names: string[]): void {
    for (const raw of names) {
        const name = normalizeIdentifier(raw);
        if (!name || PYTHON_RESERVED.has(name)) continue;
        if (scope.seen.has(name)) continue;
        scope.seen.add(name);
        scope.ordered.push(name);
    }
}

function getFieldValue(block: Block, fieldId: string): string {
    const field = block.content.editable.find((editable) => editable.id === fieldId);
    return field?.value ?? '';
}

function uniqueNames(names: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of names) {
        const name = normalizeIdentifier(raw);
        if (!name || seen.has(name)) continue;
        seen.add(name);
        out.push(name);
    }
    return out;
}

function extractIdentifiers(source: string, skipDotted = true): string[] {
    if (!source) return [];

    const out: string[] = [];
    const seen = new Set<string>();
    const regex = /[A-Za-z_][A-Za-z0-9_]*/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(source)) !== null) {
        const name = match[0];
        const index = match.index;
        if (skipDotted && index > 0 && source[index - 1] === '.') continue;
        if (PYTHON_RESERVED.has(name)) continue;
        if (seen.has(name)) continue;
        seen.add(name);
        out.push(name);
    }

    return out;
}

function parseCommaSeparatedList(source: string): string[] {
    return source
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
}

function parseImportBindings(source: string): string[] {
    const names: string[] = [];
    for (const entry of parseCommaSeparatedList(source)) {
        const asMatch = entry.match(/\bas\s+([A-Za-z_][A-Za-z0-9_]*)$/);
        if (asMatch) {
            names.push(asMatch[1]);
            continue;
        }
        const first = extractIdentifiers(entry, false)[0];
        if (first) names.push(first);
    }
    return uniqueNames(names);
}

function parseFromImportBindings(source: string): string[] {
    const names: string[] = [];
    for (const entry of parseCommaSeparatedList(source)) {
        if (entry === '*') continue;
        const asMatch = entry.match(/\bas\s+([A-Za-z_][A-Za-z0-9_]*)$/);
        if (asMatch) {
            names.push(asMatch[1]);
            continue;
        }
        const first = extractIdentifiers(entry, false)[0];
        if (first) names.push(first);
    }
    return uniqueNames(names);
}

function parseFunctionParams(source: string): string[] {
    const names: string[] = [];
    for (const rawPart of parseCommaSeparatedList(source)) {
        if (rawPart === '/' || rawPart === '*') continue;
        let part = rawPart.trim();
        part = part.replace(/^\*+/, '');
        part = part.split(':')[0].trim();
        part = part.split('=')[0].trim();
        if (!part) continue;
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) {
            names.push(part);
        }
    }
    return uniqueNames(names);
}

function parseWithAliases(source: string): string[] {
    const names: string[] = [];
    const regex = /\bas\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
        names.push(match[1]);
    }
    return uniqueNames(names);
}

function symbolsDefinedInCurrentScope(block: Block): string[] {
    switch (block.type) {
        case 'import':
            return parseImportBindings(getFieldValue(block, 'modules'));
        case 'fromImport':
            return parseFromImportBindings(getFieldValue(block, 'names'));
        case 'assign':
            return extractIdentifiers(getFieldValue(block, 'targets'));
        case 'augAssign':
            return extractIdentifiers(getFieldValue(block, 'target'));
        case 'annotatedAssign':
            return extractIdentifiers(getFieldValue(block, 'target'));
        case 'function':
        case 'asyncFunction':
        case 'class':
            return extractIdentifiers(getFieldValue(block, 'name'));
        case 'for':
            return extractIdentifiers(getFieldValue(block, 'target'));
        case 'with':
            return parseWithAliases(getFieldValue(block, 'items'));
        default:
            return [];
    }
}

function bodyScopeSeedSymbols(block: Block): string[] {
    if (block.type === 'function' || block.type === 'asyncFunction') {
        return parseFunctionParams(getFieldValue(block, 'params'));
    }
    if (block.type === 'except') {
        return extractIdentifiers(getFieldValue(block, 'name'));
    }
    return [];
}

function observedSymbolsInBlock(block: Block): string[] {
    if (block.type === 'comment') return [];

    const out: string[] = [];
    for (const field of block.content.editable) {
        if (field.id === 'operator' || field.id === 'isFrom' || field.id === 'text') {
            continue;
        }
        out.push(...extractIdentifiers(field.value, true));
    }
    return uniqueNames(out);
}

function collectObservedSymbols(blocks: Block[]): string[] {
    const ordered: string[] = [];
    const seen = new Set<string>();

    const visit = (list: Block[]) => {
        for (const block of list) {
            for (const name of observedSymbolsInBlock(block)) {
                if (!seen.has(name)) {
                    seen.add(name);
                    ordered.push(name);
                }
            }
            if (block.children) visit(block.children);
            if (block.attachments) visit(block.attachments);
        }
    };

    visit(blocks);
    return ordered;
}

function buildSuggestionList(
    scopeChain: ScopeFrame[],
    fallbackSymbols: string[],
    limit: number,
): string[] {
    const out: string[] = [];
    const seen = new Set<string>();

    const push = (name: string) => {
        if (seen.has(name)) return;
        seen.add(name);
        out.push(name);
    };

    // Prioritize nearest lexical scope and most-recent definitions first.
    for (let i = scopeChain.length - 1; i >= 0; i--) {
        const symbols = scopeChain[i].ordered;
        for (let j = symbols.length - 1; j >= 0; j--) {
            push(symbols[j]);
            if (out.length >= limit) return out;
        }
    }

    for (const name of fallbackSymbols) {
        push(name);
        if (out.length >= limit) break;
    }

    return out;
}

function branchLocalAdditions(
    branchScopeChain: ScopeFrame[],
    baselineLocalSymbols: Set<string>,
): string[] {
    const branchScope = currentScope(branchScopeChain);
    return branchScope.ordered.filter((name) => !baselineLocalSymbols.has(name));
}

function visitBlocks(
    blocks: Block[],
    scopeChain: ScopeFrame[],
    fallbackSymbols: string[],
    limit: number,
    scopedMap: Record<string, string[]>,
): void {
    for (const block of blocks) {
        visitBlock(block, scopeChain, fallbackSymbols, limit, scopedMap);
    }
}

function visitBlock(
    block: Block,
    scopeChain: ScopeFrame[],
    fallbackSymbols: string[],
    limit: number,
    scopedMap: Record<string, string[]>,
): void {
    const localScope = currentScope(scopeChain);
    scopedMap[block.id] = buildSuggestionList(scopeChain, fallbackSymbols, limit);

    // Names defined on the current statement become visible to nested blocks
    // and (where Python allows) later siblings.
    addSymbols(localScope, symbolsDefinedInCurrentScope(block));

    if (block.type === 'function' || block.type === 'asyncFunction' || block.type === 'class') {
        const childScope = createScopeFrame(bodyScopeSeedSymbols(block));
        const childScopeChain = [...scopeChain, childScope];
        visitBlocks(block.children ?? [], childScopeChain, fallbackSymbols, limit, scopedMap);
        visitBlocks(block.attachments ?? [], childScopeChain, fallbackSymbols, limit, scopedMap);
        return;
    }

    if (block.type === 'except') {
        // except "as name" is only visible inside the except branch.
        const aliasSymbols = bodyScopeSeedSymbols(block);
        const aliasScope = createScopeFrame(aliasSymbols);
        const exceptScopeChain = [...scopeChain, aliasScope];
        visitBlocks(block.children ?? [], exceptScopeChain, fallbackSymbols, limit, scopedMap);
        visitBlocks(block.attachments ?? [], exceptScopeChain, fallbackSymbols, limit, scopedMap);

        // Promote names defined in the branch body, but not the alias binding itself.
        const aliasSet = new Set(aliasSymbols);
        const promoted = aliasScope.ordered.filter((name) => !aliasSet.has(name));
        addSymbols(localScope, promoted);
        return;
    }

    if (BRANCHING_BLOCK_TYPES.has(block.type)) {
        const baseline = new Set(localScope.ordered);
        const merged: string[] = [];
        const mergedSet = new Set<string>();

        const visitBranch = (branch: Block[]) => {
            if (branch.length === 0) return;
            const branchScopeChain = cloneScopeChain(scopeChain);
            visitBlocks(branch, branchScopeChain, fallbackSymbols, limit, scopedMap);
            for (const name of branchLocalAdditions(branchScopeChain, baseline)) {
                if (mergedSet.has(name)) continue;
                mergedSet.add(name);
                merged.push(name);
            }
        };

        visitBranch(block.children ?? []);
        for (const attachment of block.attachments ?? []) {
            visitBranch([attachment]);
        }

        addSymbols(localScope, merged);
        return;
    }

    visitBlocks(block.children ?? [], scopeChain, fallbackSymbols, limit, scopedMap);
    visitBlocks(block.attachments ?? [], scopeChain, fallbackSymbols, limit, scopedMap);
}

export function buildScopedSymbolSuggestionMap(
    blocks: Block[],
    limit = DEFAULT_SUGGESTION_LIMIT,
): Record<string, string[]> {
    const safeLimit = Math.max(1, limit);
    const fallback = collectObservedSymbols(blocks);
    const scopedMap: Record<string, string[]> = {};
    const scopeChain = [createScopeFrame()];
    visitBlocks(blocks, scopeChain, fallback, safeLimit, scopedMap);
    return scopedMap;
}

export function collectSymbolSuggestions(
    blocks: Block[],
    limit = DEFAULT_SUGGESTION_LIMIT,
): string[] {
    const safeLimit = Math.max(1, limit);
    return collectObservedSymbols(blocks).slice(0, safeLimit);
}
