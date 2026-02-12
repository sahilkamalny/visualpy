/**
 * Message types for extension ↔ webview communication
 */

import { Block } from './blocks';

export type Theme = 'dark' | 'light' | 'high-contrast';

export interface Config {
    syncMode: 'manual' | 'onSave' | 'realtime';
    indentSize: number;
    indentStyle: 'spaces' | 'tabs';
    defaultZoom: number;
    showMinimap: boolean;
    palettePosition: 'left' | 'right' | 'hidden';
}

export type SyncStatus = 'synced' | 'pending' | 'error';

// Extension → Webview messages
export type ExtensionMessage =
    | { type: 'INIT'; payload: { blocks: Block[]; theme: Theme; config: Config; fileName: string } }
    | { type: 'UPDATE_BLOCKS'; payload: { blocks: Block[] } }
    | { type: 'SYNC_STATUS'; payload: { status: SyncStatus; message?: string } }
    | { type: 'THEME_CHANGED'; payload: { theme: Theme } }
    | { type: 'CONFIG_CHANGED'; payload: { config: Partial<Config> } }
    | { type: 'PARSE_ERROR'; payload: { message: string; line?: number } };

// Webview → Extension messages
export type WebviewMessage =
    | { type: 'READY' }
    | { type: 'BLOCKS_CHANGED'; payload: { blocks: Block[] } }
    | { type: 'REQUEST_SYNC'; payload: { direction: 'toCode' | 'toBlocks'; blocks?: Block[] } }
    | { type: 'BLOCK_SELECTED'; payload: { blockId: string; sourceRange: { startLine: number; endLine: number } } }
    | { type: 'REQUEST_PARSE' }
    | { type: 'LOG'; payload: { level: 'info' | 'warn' | 'error'; message: string } }
    | { type: 'ERROR'; payload: { message: string } };

export type Message = ExtensionMessage | WebviewMessage;
