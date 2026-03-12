import * as assert from 'assert';
import { astToBlocks } from '../../mapper/codeToBlocks';
import { ParseResult } from '../../types';

function createParseResult(overrides: Partial<ParseResult>): ParseResult {
    return {
        success: true,
        ast: {
            type: 'Module',
            lineno: 1,
            col_offset: 0,
            end_lineno: 1,
            end_col_offset: 0,
            body: []
        },
        comments: [],
        errors: [],
        ...overrides
    } as ParseResult;
}

suite('codeToBlocks Test Suite', () => {
    test('should convert trailing standalone comment at EOF into a comment block', () => {
        const parseResult = createParseResult({
            ast: {
                type: 'Module',
                lineno: 1,
                col_offset: 0,
                end_lineno: 2,
                end_col_offset: 0,
                body: [
                    {
                        type: 'Pass',
                        lineno: 1,
                        col_offset: 0,
                        end_lineno: 1,
                        end_col_offset: 4,
                        source: 'pass'
                    }
                ]
            } as any,
            comments: [{ line: 2, column: 0, text: 'bottom comment', inline: false }]
        });

        const blocks = astToBlocks(parseResult);
        assert.strictEqual(blocks.length, 2);
        assert.strictEqual(blocks[0].type, 'pass');
        assert.strictEqual(blocks[1].type, 'comment');
        assert.strictEqual(blocks[1].content.editable[0].value, 'bottom comment');
    });

    test('should preserve ordering for multiple trailing comments after a statement', () => {
        const parseResult = createParseResult({
            ast: {
                type: 'Module',
                lineno: 1,
                col_offset: 0,
                end_lineno: 4,
                end_col_offset: 0,
                body: [
                    {
                        type: 'Pass',
                        lineno: 1,
                        col_offset: 0,
                        end_lineno: 1,
                        end_col_offset: 4,
                        source: 'pass'
                    }
                ]
            } as any,
            comments: [
                { line: 3, column: 0, text: 'third line comment', inline: false },
                { line: 4, column: 0, text: 'fourth line comment', inline: false }
            ]
        });

        const blocks = astToBlocks(parseResult);
        assert.strictEqual(blocks.length, 3);
        assert.deepStrictEqual(
            blocks.map((block) => block.type),
            ['pass', 'comment', 'comment']
        );
        assert.deepStrictEqual(
            blocks.slice(1).map((block) => block.content.editable[0].value),
            ['third line comment', 'fourth line comment']
        );
    });

    test('should convert comment-only files into comment blocks', () => {
        const parseResult = createParseResult({
            ast: {
                type: 'Module',
                lineno: 1,
                col_offset: 0,
                end_lineno: 2,
                end_col_offset: 0,
                body: []
            } as any,
            comments: [
                { line: 1, column: 0, text: 'first', inline: false },
                { line: 2, column: 0, text: 'second', inline: false }
            ]
        });

        const blocks = astToBlocks(parseResult);
        assert.strictEqual(blocks.length, 2);
        assert.ok(blocks.every((block) => block.type === 'comment'));
        assert.deepStrictEqual(
            blocks.map((block) => block.content.editable[0].value),
            ['first', 'second']
        );
    });

    test('should keep inline comments attached to their statement block', () => {
        const parseResult = createParseResult({
            ast: {
                type: 'Module',
                lineno: 1,
                col_offset: 0,
                end_lineno: 1,
                end_col_offset: 4,
                body: [
                    {
                        type: 'Pass',
                        lineno: 1,
                        col_offset: 0,
                        end_lineno: 1,
                        end_col_offset: 4,
                        source: 'pass'
                    }
                ]
            } as any,
            comments: [{ line: 1, column: 5, text: 'inline note', inline: true }]
        });

        const blocks = astToBlocks(parseResult);
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].type, 'pass');
        assert.strictEqual(blocks[0].metadata.comments.length, 1);
        assert.strictEqual(blocks[0].metadata.comments[0].text, 'inline note');
        assert.strictEqual(blocks[0].metadata.comments[0].inline, true);
    });
});
