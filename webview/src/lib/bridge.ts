/**
 * Typed postMessage bridge for VS Code webview ↔ extension host communication.
 * Singleton — acquires vscode API once on import.
 */
import type { WebviewMessage, ExtensionMessage } from './types';

let _vscode: VsCodeApi | null = null;

function getVsCodeApi(): VsCodeApi {
    if (!_vscode) {
        _vscode = acquireVsCodeApi();
    }
    return _vscode;
}

/** Send a typed message to the extension host */
export function send(message: WebviewMessage): void {
    getVsCodeApi().postMessage(message);
}

/** Log to the extension host's output channel */
export function log(level: 'info' | 'warn' | 'error', message: string): void {
    send({ type: 'LOG', payload: { level, message } });
}

/** Persist state across webview lifecycle (survives tab hide/show) */
export function saveState(state: unknown): void {
    getVsCodeApi().setState(state);
}

/** Restore persisted state */
export function loadState<T>(): T | undefined {
    return getVsCodeApi().getState() as T | undefined;
}

/** Type-safe message listener. Returns an unsubscribe function. */
export function onMessage(handler: (message: ExtensionMessage) => void): () => void {
    const listener = (event: MessageEvent) => {
        handler(event.data as ExtensionMessage);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
}
