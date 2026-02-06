import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { ParseResult } from '../types';
import { Logger } from '../utils/logger';
import { getPythonPath } from '../utils/config';

/**
 * Service for parsing Python code using a subprocess
 */
export class PythonParserService {
    private context: vscode.ExtensionContext;
    private pythonPath: string | null = null;
    private parserScriptPath: string;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        // Check dist/resources first (webpack output), then resources (dev mode)
        const distPath = path.join(context.extensionPath, 'dist', 'resources', 'parser.py');
        const devPath = path.join(context.extensionPath, 'resources', 'parser.py');

        if (fs.existsSync(distPath)) {
            this.parserScriptPath = distPath;
        } else {
            this.parserScriptPath = devPath;
        }
        Logger.info(`Parser script path: ${this.parserScriptPath}`);
    }

    /**
     * Initialize the parser service
     */
    async initialize(): Promise<void> {
        this.pythonPath = await getPythonPath();
        Logger.info(`Python parser initialized with: ${this.pythonPath}`);
    }

    /**
     * Parse Python source code and return the AST
     */
    async parse(source: string): Promise<ParseResult> {
        if (!this.pythonPath) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const process = spawn(this.pythonPath!, [this.parserScriptPath], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            process.on('close', (code: number) => {
                const elapsed = Date.now() - startTime;
                Logger.debug(`Parser completed in ${elapsed}ms with code ${code}`);

                if (code !== 0) {
                    Logger.error(`Parser error: ${stderr}`);
                    resolve({
                        success: false,
                        ast: null,
                        comments: [],
                        errors: [{
                            message: `Parser process exited with code ${code}: ${stderr}`,
                            lineno: null,
                            col_offset: null
                        }]
                    });
                    return;
                }

                try {
                    const result = JSON.parse(stdout) as ParseResult;
                    resolve(result);
                } catch (e) {
                    Logger.error('Failed to parse JSON output', e);
                    resolve({
                        success: false,
                        ast: null,
                        comments: [],
                        errors: [{
                            message: `Failed to parse output: ${e}`,
                            lineno: null,
                            col_offset: null
                        }]
                    });
                }
            });

            process.on('error', (err: Error) => {
                Logger.error('Parser process error', err);
                resolve({
                    success: false,
                    ast: null,
                    comments: [],
                    errors: [{
                        message: `Failed to start parser: ${err.message}`,
                        lineno: null,
                        col_offset: null
                    }]
                });
            });

            // Write source code to stdin
            process.stdin.write(source);
            process.stdin.end();
        });
    }

    /**
     * Validate that the parser is working
     */
    async validate(): Promise<boolean> {
        try {
            const result = await this.parse('x = 1');
            return result.success;
        } catch {
            return false;
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        // Nothing to dispose currently
    }
}
