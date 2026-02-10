/**
 * UI state store — selection, zoom, sync status, etc.
 * Separate from block data to keep concerns clean.
 */
import type { SyncStatus } from '../types';

class UIStateStore {
    selectedBlockId = $state<string | null>(null);
    zoomLevel = $state(100);
    syncStatus = $state<SyncStatus>('synced');
    fileName = $state('No file open');
    autoSave = $state(true);

    // Context menu
    contextMenu = $state<{
        visible: boolean;
        x: number;
        y: number;
        blockId: string | null;
    }>({ visible: false, x: 0, y: 0, blockId: null });

    // Clipboard
    clipboard = $state<unknown>(null);

    selectBlock(id: string | null): void {
        this.selectedBlockId = id;
    }

    setZoom(level: number): void {
        this.zoomLevel = Math.max(50, Math.min(200, level));
    }

    zoomIn(): void {
        this.setZoom(this.zoomLevel + 10);
    }

    zoomOut(): void {
        this.setZoom(this.zoomLevel - 10);
    }

    resetZoom(): void {
        this.setZoom(100);
    }

    showContextMenu(x: number, y: number, blockId: string | null): void {
        this.contextMenu = { visible: true, x, y, blockId };
    }

    hideContextMenu(): void {
        this.contextMenu = { visible: false, x: 0, y: 0, blockId: null };
    }

    setSyncStatus(status: SyncStatus): void {
        this.syncStatus = status;
    }

    setFileName(name: string): void {
        this.fileName = name;
    }
}

export const uiState = new UIStateStore();
