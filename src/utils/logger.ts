import * as vscode from 'vscode';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Simple logger for VisualPy extension
 */
export class Logger {
    private static outputChannel: vscode.OutputChannel | null = null;
    private static level: LogLevel = 'info';

    private static readonly LEVELS: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    };

    private static getChannel(): vscode.OutputChannel {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('VisualPy');
        }
        return this.outputChannel;
    }

    private static shouldLog(level: LogLevel): boolean {
        return this.LEVELS[level] >= this.LEVELS[this.level];
    }

    private static formatMessage(level: LogLevel, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    static setLevel(level: LogLevel): void {
        this.level = level;
    }

    static debug(message: string, ...args: any[]): void {
        if (this.shouldLog('debug')) {
            const formatted = this.formatMessage('debug', message);
            this.getChannel().appendLine(formatted);
            if (args.length > 0) {
                this.getChannel().appendLine(JSON.stringify(args, null, 2));
            }
        }
    }

    static info(message: string, ...args: any[]): void {
        if (this.shouldLog('info')) {
            const formatted = this.formatMessage('info', message);
            this.getChannel().appendLine(formatted);
            if (args.length > 0) {
                this.getChannel().appendLine(JSON.stringify(args, null, 2));
            }
        }
    }

    static warn(message: string, ...args: any[]): void {
        if (this.shouldLog('warn')) {
            const formatted = this.formatMessage('warn', message);
            this.getChannel().appendLine(formatted);
            if (args.length > 0) {
                this.getChannel().appendLine(JSON.stringify(args, null, 2));
            }
        }
    }

    static error(message: string, error?: Error | unknown): void {
        if (this.shouldLog('error')) {
            const formatted = this.formatMessage('error', message);
            this.getChannel().appendLine(formatted);
            if (error instanceof Error) {
                this.getChannel().appendLine(`  Stack: ${error.stack}`);
            } else if (error) {
                this.getChannel().appendLine(`  Details: ${JSON.stringify(error)}`);
            }
        }
    }

    static show(): void {
        this.getChannel().show();
    }

    static dispose(): void {
        if (this.outputChannel) {
            this.outputChannel.dispose();
            this.outputChannel = null;
        }
    }
}
