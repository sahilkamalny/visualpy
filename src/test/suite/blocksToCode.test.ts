import * as assert from 'assert';
import { blocksToCode } from '../../mapper/blocksToCode';
import { Block } from '../../types';

suite('blocksToCode Test Suite', () => {

    test('should convert empty blocks array to empty string', () => {
        const result = blocksToCode([]);
        assert.strictEqual(result.trim(), '');
    });

    test('should convert import block', () => {
        const blocks: Block[] = [{
            id: 'test-import',
            type: 'import',
            category: 'imports',
            content: {
                raw: 'import os',
                editable: [{ id: 'modules', label: 'Modules', value: 'os' }]
            },
            metadata: {
                sourceRange: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 9 },
                comments: [],
                collapsed: false
            }
        }];

        const result = blocksToCode(blocks);
        assert.ok(result.includes('import os'));
    });

    test('should convert assignment block', () => {
        const blocks: Block[] = [{
            id: 'test-assign',
            type: 'assign',
            category: 'variables',
            content: {
                raw: 'x = 10',
                editable: [
                    { id: 'targets', label: 'Variable', value: 'x' },
                    { id: 'value', label: 'Value', value: '10' }
                ]
            },
            metadata: {
                sourceRange: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 6 },
                comments: [],
                collapsed: false
            }
        }];

        const result = blocksToCode(blocks);
        assert.ok(result.includes('x = 10'));
    });

    test('should convert function definition block', () => {
        const blocks: Block[] = [{
            id: 'test-func',
            type: 'function',
            category: 'functions',
            content: {
                raw: 'def greet(name)',
                editable: [
                    { id: 'name', label: 'Name', value: 'greet' },
                    { id: 'params', label: 'Parameters', value: 'name' }
                ]
            },
            children: [{
                id: 'test-pass',
                type: 'pass',
                category: 'misc',
                content: { raw: 'pass', editable: [] },
                metadata: {
                    sourceRange: { startLine: 2, startColumn: 4, endLine: 2, endColumn: 8 },
                    comments: [],
                    collapsed: false
                }
            }],
            metadata: {
                sourceRange: { startLine: 1, startColumn: 0, endLine: 2, endColumn: 8 },
                comments: [],
                collapsed: false
            }
        }];

        const result = blocksToCode(blocks);
        assert.ok(result.includes('def greet(name):'));
        assert.ok(result.includes('pass'));
    });

    test('should convert if block with condition', () => {
        const blocks: Block[] = [{
            id: 'test-if',
            type: 'if',
            category: 'control',
            content: {
                raw: 'if x > 0',
                editable: [{ id: 'condition', label: 'Condition', value: 'x > 0' }]
            },
            children: [{
                id: 'test-pass',
                type: 'pass',
                category: 'misc',
                content: { raw: 'pass', editable: [] },
                metadata: {
                    sourceRange: { startLine: 2, startColumn: 4, endLine: 2, endColumn: 8 },
                    comments: [],
                    collapsed: false
                }
            }],
            metadata: {
                sourceRange: { startLine: 1, startColumn: 0, endLine: 2, endColumn: 8 },
                comments: [],
                collapsed: false
            }
        }];

        const result = blocksToCode(blocks);
        assert.ok(result.includes('if x > 0:'));
    });

    test('should convert for loop block', () => {
        const blocks: Block[] = [{
            id: 'test-for',
            type: 'for',
            category: 'loops',
            content: {
                raw: 'for i in range(10)',
                editable: [
                    { id: 'target', label: 'Variable', value: 'i' },
                    { id: 'iterable', label: 'Iterable', value: 'range(10)' }
                ]
            },
            children: [{
                id: 'test-pass',
                type: 'pass',
                category: 'misc',
                content: { raw: 'pass', editable: [] },
                metadata: {
                    sourceRange: { startLine: 2, startColumn: 4, endLine: 2, endColumn: 8 },
                    comments: [],
                    collapsed: false
                }
            }],
            metadata: {
                sourceRange: { startLine: 1, startColumn: 0, endLine: 2, endColumn: 8 },
                comments: [],
                collapsed: false
            }
        }];

        const result = blocksToCode(blocks);
        assert.ok(result.includes('for i in range(10):'));
    });

    test('should preserve comments', () => {
        const blocks: Block[] = [{
            id: 'test-assign',
            type: 'assign',
            category: 'variables',
            content: {
                raw: 'x = 10',
                editable: [
                    { id: 'targets', label: 'Variable', value: 'x' },
                    { id: 'value', label: 'Value', value: '10' }
                ]
            },
            metadata: {
                sourceRange: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 6 },
                comments: [{ text: 'Initialize x', inline: false, line: 1, column: 0 }],
                collapsed: false
            }
        }];

        const result = blocksToCode(blocks);
        assert.ok(result.includes('# Initialize x'));
    });

    test('should append inline comments to generated line', () => {
        const blocks: Block[] = [{
            id: 'test-assign-inline',
            type: 'assign',
            category: 'variables',
            content: {
                raw: 'x = 10',
                editable: [
                    { id: 'targets', label: 'Variable', value: 'x' },
                    { id: 'value', label: 'Value', value: '10' }
                ]
            },
            metadata: {
                sourceRange: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 6 },
                comments: [{ text: 'inline note', inline: true, line: 1, column: 7 }],
                collapsed: false
            }
        }];

        const result = blocksToCode(blocks);
        assert.ok(result.includes('x = 10  # inline note'));
    });

    test('should generate if/elif/else attachment chains in order', () => {
        const blocks: Block[] = [{
            id: 'test-if-chain',
            type: 'if',
            category: 'control',
            content: {
                raw: 'if x > 0',
                editable: [{ id: 'condition', label: 'Condition', value: 'x > 0' }]
            },
            children: [{
                id: 'if-then',
                type: 'expression',
                category: 'misc',
                content: {
                    raw: 'do_positive()',
                    editable: [{ id: 'expression', label: 'Expression', value: 'do_positive()' }]
                },
                metadata: {
                    sourceRange: { startLine: 2, startColumn: 4, endLine: 2, endColumn: 17 },
                    comments: [],
                    collapsed: false
                }
            }],
            attachments: [{
                id: 'if-elif',
                type: 'elif',
                category: 'control',
                content: {
                    raw: 'elif x == 0',
                    editable: [{ id: 'condition', label: 'Condition', value: 'x == 0' }]
                },
                children: [{
                    id: 'elif-then',
                    type: 'expression',
                    category: 'misc',
                    content: {
                        raw: 'do_zero()',
                        editable: [{ id: 'expression', label: 'Expression', value: 'do_zero()' }]
                    },
                    metadata: {
                        sourceRange: { startLine: 4, startColumn: 4, endLine: 4, endColumn: 13 },
                        comments: [],
                        collapsed: false
                    }
                }],
                attachments: [{
                    id: 'if-else',
                    type: 'else',
                    category: 'control',
                    content: { raw: 'else:', editable: [] },
                    children: [{
                        id: 'else-then',
                        type: 'expression',
                        category: 'misc',
                        content: {
                            raw: 'do_negative()',
                            editable: [{ id: 'expression', label: 'Expression', value: 'do_negative()' }]
                        },
                        metadata: {
                            sourceRange: { startLine: 6, startColumn: 4, endLine: 6, endColumn: 17 },
                            comments: [],
                            collapsed: false
                        }
                    }],
                    metadata: {
                        sourceRange: { startLine: 5, startColumn: 0, endLine: 6, endColumn: 17 },
                        comments: [],
                        collapsed: false
                    }
                }],
                metadata: {
                    sourceRange: { startLine: 3, startColumn: 0, endLine: 6, endColumn: 17 },
                    comments: [],
                    collapsed: false
                }
            }],
            metadata: {
                sourceRange: { startLine: 1, startColumn: 0, endLine: 6, endColumn: 17 },
                comments: [],
                collapsed: false
            }
        }];

        const result = blocksToCode(blocks);
        const expected = [
            'if x > 0:',
            '    do_positive()',
            'elif x == 0:',
            '    do_zero()',
            'else:',
            '    do_negative()',
            ''
        ].join('\n');
        assert.strictEqual(result, expected);
    });

    test('should generate try/except/else/finally attachments in order', () => {
        const blocks: Block[] = [{
            id: 'test-try',
            type: 'try',
            category: 'exceptions',
            content: { raw: 'try:', editable: [] },
            children: [{
                id: 'try-body',
                type: 'expression',
                category: 'misc',
                content: {
                    raw: 'risky_call()',
                    editable: [{ id: 'expression', label: 'Expression', value: 'risky_call()' }]
                },
                metadata: {
                    sourceRange: { startLine: 2, startColumn: 4, endLine: 2, endColumn: 15 },
                    comments: [],
                    collapsed: false
                }
            }],
            attachments: [
                {
                    id: 'try-except',
                    type: 'except',
                    category: 'exceptions',
                    content: {
                        raw: 'except ValueError as err:',
                        editable: [
                            { id: 'type', label: 'Exception Type', value: 'ValueError' },
                            { id: 'name', label: 'As Name', value: 'err' }
                        ]
                    },
                    children: [{
                        id: 'except-body',
                        type: 'expression',
                        category: 'misc',
                        content: {
                            raw: 'handle(err)',
                            editable: [{ id: 'expression', label: 'Expression', value: 'handle(err)' }]
                        },
                        metadata: {
                            sourceRange: { startLine: 4, startColumn: 4, endLine: 4, endColumn: 15 },
                            comments: [],
                            collapsed: false
                        }
                    }],
                    metadata: {
                        sourceRange: { startLine: 3, startColumn: 0, endLine: 4, endColumn: 15 },
                        comments: [],
                        collapsed: false
                    }
                },
                {
                    id: 'try-else',
                    type: 'else',
                    category: 'control',
                    content: { raw: 'else:', editable: [] },
                    children: [{
                        id: 'else-body',
                        type: 'expression',
                        category: 'misc',
                        content: {
                            raw: 'on_success()',
                            editable: [{ id: 'expression', label: 'Expression', value: 'on_success()' }]
                        },
                        metadata: {
                            sourceRange: { startLine: 6, startColumn: 4, endLine: 6, endColumn: 16 },
                            comments: [],
                            collapsed: false
                        }
                    }],
                    metadata: {
                        sourceRange: { startLine: 5, startColumn: 0, endLine: 6, endColumn: 16 },
                        comments: [],
                        collapsed: false
                    }
                },
                {
                    id: 'try-finally',
                    type: 'finally',
                    category: 'exceptions',
                    content: { raw: 'finally:', editable: [] },
                    children: [{
                        id: 'finally-body',
                        type: 'expression',
                        category: 'misc',
                        content: {
                            raw: 'cleanup()',
                            editable: [{ id: 'expression', label: 'Expression', value: 'cleanup()' }]
                        },
                        metadata: {
                            sourceRange: { startLine: 8, startColumn: 4, endLine: 8, endColumn: 13 },
                            comments: [],
                            collapsed: false
                        }
                    }],
                    metadata: {
                        sourceRange: { startLine: 7, startColumn: 0, endLine: 8, endColumn: 13 },
                        comments: [],
                        collapsed: false
                    }
                }
            ],
            metadata: {
                sourceRange: { startLine: 1, startColumn: 0, endLine: 8, endColumn: 13 },
                comments: [],
                collapsed: false
            }
        }];

        const result = blocksToCode(blocks);
        const expected = [
            'try:',
            '    risky_call()',
            'except ValueError as err:',
            '    handle(err)',
            'else:',
            '    on_success()',
            'finally:',
            '    cleanup()',
            ''
        ].join('\n');
        assert.strictEqual(result, expected);
    });

    test('should preserve complex assert conditions from condition composer', () => {
        const blocks: Block[] = [{
            id: 'test-assert-complex',
            type: 'assert',
            category: 'misc',
            content: {
                raw: 'assert ((left > right) and status) or flag, "boom"',
                editable: [
                    {
                        id: 'condition',
                        label: 'Condition',
                        value: '((left > right) and status) or flag'
                    },
                    { id: 'message', label: 'Message', value: '"boom"' }
                ]
            },
            metadata: {
                sourceRange: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 54 },
                comments: [],
                collapsed: false
            }
        }];

        const result = blocksToCode(blocks);
        assert.strictEqual(
            result,
            'assert ((left > right) and status) or flag, "boom"\n'
        );
    });
});
