// Type declarations for Svelte files
declare module '*.svelte' {
    import type { Component } from 'svelte';
    const component: Component;
    export default component;
}

// VS Code webview API type
interface VsCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;
