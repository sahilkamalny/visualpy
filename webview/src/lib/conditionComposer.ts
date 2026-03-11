export type ConditionOperator =
    | ""
    | "=="
    | "!="
    | "<"
    | "<="
    | ">"
    | ">="
    | "and"
    | "or"
    | "in"
    | "not in"
    | "is"
    | "is not";

export interface ConditionModel {
    values: string[];
    operators: ConditionOperator[];
    parenPairs: Record<string, number>;
}

export const CONDITION_OPERATORS: ConditionOperator[] = [
    "==",
    "!=",
    ">",
    ">=",
    "<",
    "<=",
    "and",
    "or",
    "in",
    "not in",
    "is",
    "is not",
];

const SORTED_OPERATORS = [...CONDITION_OPERATORS].sort(
    (a, b) => b.length - a.length,
);
const WORD_OP_RE = /[A-Za-z_0-9]/;

function pairKey(start: number, end: number): string {
    return `${start}:${end}`;
}

function parsePairKey(key: string): { start: number; end: number } | null {
    const [startRaw, endRaw] = key.split(":");
    const start = Number.parseInt(startRaw, 10);
    const end = Number.parseInt(endRaw, 10);
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
    return { start, end };
}

function clonePairs(
    parenPairs: Record<string, number>,
): Record<string, number> {
    return { ...parenPairs };
}

function incrementPair(
    parenPairs: Record<string, number>,
    start: number,
    end: number,
): void {
    const normalizedStart = Math.min(start, end);
    const normalizedEnd = Math.max(start, end);
    const key = pairKey(normalizedStart, normalizedEnd);
    parenPairs[key] = (parenPairs[key] || 0) + 1;
}

function matchOperator(
    source: string,
    index: number,
): { op: ConditionOperator; length: number } | null {
    for (const op of SORTED_OPERATORS) {
        if (
            source.slice(index, index + op.length).toLowerCase() !==
            op.toLowerCase()
        ) {
            continue;
        }

        if (op.includes(" ")) {
            const prev = index > 0 ? source[index - 1] : " ";
            const next =
                index + op.length < source.length
                    ? source[index + op.length]
                    : " ";
            if (WORD_OP_RE.test(prev) || WORD_OP_RE.test(next)) {
                continue;
            }
        } else if (/^[A-Za-z]+$/.test(op)) {
            const prev = index > 0 ? source[index - 1] : " ";
            const next =
                index + op.length < source.length
                    ? source[index + op.length]
                    : " ";
            if (WORD_OP_RE.test(prev) || WORD_OP_RE.test(next)) {
                continue;
            }
        }

        return { op, length: op.length };
    }
    return null;
}

function fallbackSingleValueModel(source: string): ConditionModel {
    return {
        values: [source],
        operators: [],
        parenPairs: {},
    };
}

export function createEmptyConditionModel(): ConditionModel {
    return {
        values: [""],
        operators: [],
        parenPairs: {},
    };
}

export function normalizeConditionModel(model: ConditionModel): ConditionModel {
    const values = [...(model.values || [])];
    const operators = [...(model.operators || [])];
    const parenPairs = clonePairs(model.parenPairs || {});

    if (values.length === 0) {
        values.push("");
    }

    while (operators.length > values.length - 1) {
        operators.pop();
    }
    while (operators.length < values.length - 1) {
        operators.push("");
    }

    const maxIndex = values.length - 1;
    for (const [key, count] of Object.entries(parenPairs)) {
        const parsed = parsePairKey(key);
        if (!parsed || count <= 0) {
            delete parenPairs[key];
            continue;
        }
        if (
            parsed.start < 0 ||
            parsed.end < 0 ||
            parsed.start > parsed.end ||
            parsed.start > maxIndex ||
            parsed.end > maxIndex
        ) {
            delete parenPairs[key];
        }
    }

    return { values, operators, parenPairs };
}

export function parseConditionExpression(expression: string): ConditionModel {
    const source = expression.trim();
    if (!source) {
        return createEmptyConditionModel();
    }

    const values: string[] = [];
    const operators: ConditionOperator[] = [];
    const parenPairs: Record<string, number> = {};
    const startStack: number[] = [];

    let i = 0;
    while (i < source.length) {
        while (i < source.length && /\s/.test(source[i])) i++;

        let leadingParens = 0;
        while (i < source.length && source[i] === "(") {
            leadingParens++;
            i++;
            while (i < source.length && /\s/.test(source[i])) i++;
        }

        const valueStart = i;
        let nestedDepth = 0;
        let quote: "'" | '"' | null = null;

        while (i < source.length) {
            const ch = source[i];

            if (quote) {
                if (ch === "\\") {
                    i += 2;
                    continue;
                }
                if (ch === quote) {
                    quote = null;
                }
                i++;
                continue;
            }

            if (ch === "'" || ch === '"') {
                quote = ch;
                i++;
                continue;
            }

            if (ch === "(" || ch === "[" || ch === "{") {
                nestedDepth++;
                i++;
                continue;
            }

            if (ch === ")" || ch === "]" || ch === "}") {
                if (ch === ")" && nestedDepth === 0) {
                    break;
                }
                nestedDepth = Math.max(0, nestedDepth - 1);
                i++;
                continue;
            }

            if (nestedDepth === 0) {
                const op = matchOperator(source, i);
                if (op) {
                    break;
                }
            }

            i++;
        }

        const currentValue = source.slice(valueStart, i).trim();
        values.push(currentValue);
        const valueIndex = values.length - 1;

        while (i < source.length && /\s/.test(source[i])) i++;

        let trailingParens = 0;
        while (i < source.length && source[i] === ")") {
            trailingParens++;
            i++;
            while (i < source.length && /\s/.test(source[i])) i++;
        }

        for (let open = 0; open < leadingParens; open++) {
            startStack.push(valueIndex);
        }
        for (let close = 0; close < trailingParens; close++) {
            const start = startStack.pop();
            if (start == null) {
                return fallbackSingleValueModel(source);
            }
            incrementPair(parenPairs, start, valueIndex);
        }

        if (i >= source.length) {
            break;
        }

        const op = matchOperator(source, i);
        if (!op) {
            return fallbackSingleValueModel(source);
        }
        operators.push(op.op);
        i += op.length;
    }

    if (startStack.length > 0) {
        return fallbackSingleValueModel(source);
    }

    if (operators.length !== values.length - 1) {
        return fallbackSingleValueModel(source);
    }

    return normalizeConditionModel({ values, operators, parenPairs });
}

export function serializeConditionExpression(model: ConditionModel): string {
    const normalized = normalizeConditionModel(model);
    const openCounts = new Array<number>(normalized.values.length).fill(0);
    const closeCounts = new Array<number>(normalized.values.length).fill(0);

    for (const [key, count] of Object.entries(normalized.parenPairs)) {
        const parsed = parsePairKey(key);
        if (!parsed || count <= 0) continue;
        openCounts[parsed.start] += count;
        closeCounts[parsed.end] += count;
    }

    const headRaw = normalized.values[0]?.trim() || "";
    if (!headRaw) {
        return "";
    }

    let output = `${"(".repeat(openCounts[0])}${headRaw}${")".repeat(
        closeCounts[0],
    )}`;

    for (let idx = 1; idx < normalized.values.length; idx++) {
        const op = (normalized.operators[idx - 1] || "").trim();
        const valueRaw = normalized.values[idx]?.trim() || "";

        // Stop at first incomplete pair so partially edited states stay valid.
        if (!op || !valueRaw) {
            break;
        }

        const formattedValue = `${"(".repeat(openCounts[idx])}${valueRaw}${")".repeat(
            closeCounts[idx],
        )}`;
        output += ` ${op} ${formattedValue}`;
    }

    return output;
}

export function addConditionPair(model: ConditionModel): ConditionModel {
    const normalized = normalizeConditionModel(model);
    return normalizeConditionModel({
        values: [...normalized.values, ""],
        operators: [...normalized.operators, ""],
        parenPairs: clonePairs(normalized.parenPairs),
    });
}

export function removeConditionPair(model: ConditionModel): ConditionModel {
    const normalized = normalizeConditionModel(model);
    if (normalized.values.length <= 1) {
        return normalized;
    }

    const nextValues = normalized.values.slice(0, -1);
    const nextOperators = normalized.operators.slice(0, -1);
    const maxIndex = nextValues.length - 1;
    const nextPairs = clonePairs(normalized.parenPairs);

    for (const key of Object.keys(nextPairs)) {
        const parsed = parsePairKey(key);
        if (!parsed) {
            delete nextPairs[key];
            continue;
        }
        if (parsed.start > maxIndex || parsed.end > maxIndex) {
            delete nextPairs[key];
        }
    }

    return normalizeConditionModel({
        values: nextValues,
        operators: nextOperators,
        parenPairs: nextPairs,
    });
}

export function toggleParenthesisPair(
    model: ConditionModel,
    firstIndex: number,
    secondIndex: number,
): ConditionModel {
    const normalized = normalizeConditionModel(model);
    const start = Math.min(firstIndex, secondIndex);
    const end = Math.max(firstIndex, secondIndex);

    if (start < 0 || end >= normalized.values.length) {
        return normalized;
    }

    const nextPairs = clonePairs(normalized.parenPairs);
    const key = pairKey(start, end);

    if (nextPairs[key] && nextPairs[key] > 0) {
        nextPairs[key] -= 1;
        if (nextPairs[key] <= 0) {
            delete nextPairs[key];
        }
    } else {
        nextPairs[key] = 1;
    }

    return normalizeConditionModel({
        values: [...normalized.values],
        operators: [...normalized.operators],
        parenPairs: nextPairs,
    });
}

export function getParenthesisCounts(model: ConditionModel): {
    openCounts: number[];
    closeCounts: number[];
} {
    const normalized = normalizeConditionModel(model);
    const openCounts = new Array<number>(normalized.values.length).fill(0);
    const closeCounts = new Array<number>(normalized.values.length).fill(0);

    for (const [key, count] of Object.entries(normalized.parenPairs)) {
        const parsed = parsePairKey(key);
        if (!parsed || count <= 0) continue;
        openCounts[parsed.start] += count;
        closeCounts[parsed.end] += count;
    }

    return { openCounts, closeCounts };
}
