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
});
