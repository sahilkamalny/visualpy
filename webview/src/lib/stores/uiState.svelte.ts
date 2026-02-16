/**
 * UI state store — selection, zoom, sync status, etc.
 * Separate from block data to keep concerns clean.
 */
import type { SyncStatus } from '../types';

class UIStateStore {
    // Multi-select: Set of selected block IDs
    selectedBlockIds = $state<string[]>([]);
    zoomLevel = $state(100);
    syncStatus = $state<SyncStatus>('synced');
    fileName = $state('No file open');
    autoSave = $state(true);
    ctrlPressed = $state(false);
    paletteCollapsed = $state(false);

    // Cursor-to-block highlight: purely visual, separate from selection
    cursorHighlightId = $state<string | null>(null);

    // Context menu
    contextMenu = $state<{
        visible: boolean;
        x: number;
        y: number;
        blockId: string | null;
    }>({ visible: false, x: 0, y: 0, blockId: null });

    // Clipboard (array for multi-select copy)
    clipboard = $state<unknown>(null);

    /** Select a single block (replacing any current selection), or clear all */
    selectBlock(id: string | null): void {
        this.selectedBlockIds = id ? [id] : [];
    }

    /** Toggle a single block in the selection (for Ctrl+click) */
    toggleBlockSelection(id: string): void {
        const idx = this.selectedBlockIds.indexOf(id);
        if (idx >= 0) {
            this.selectedBlockIds = this.selectedBlockIds.filter(x => x !== id);
        } else {
            this.selectedBlockIds = [...this.selectedBlockIds, id];
        }
    }

    /** Select all blocks or deselect all (toggle) */
    selectAll(allBlockIds: string[]): void {
        if (this.selectedBlockIds.length === allBlockIds.length && allBlockIds.length > 0) {
            this.selectedBlockIds = [];
        } else {
            this.selectedBlockIds = [...allBlockIds];
        }
    }

    /** Check if a block is selected */
    isSelected(id: string): boolean {
        return this.selectedBlockIds.includes(id);
    }

    /** Clear all selections */
    clearSelection(): void {
        this.selectedBlockIds = [];
    }

    togglePalette(): void {
        this.paletteCollapsed = !this.paletteCollapsed;
    }

    /** Get the first selected block ID (for backwards compat with single-select code) */
    get selectedBlockId(): string | null {
        return this.selectedBlockIds.length > 0 ? this.selectedBlockIds[0] : null;
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

    toast = $state<{
        visible: boolean;
        message: string;
        type: 'info' | 'error' | 'success';
    }>({ visible: false, message: '', type: 'info' });

    showToast(message: string, type: 'info' | 'error' | 'success' = 'info'): void {
        this.toast = { visible: true, message, type };
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (this.toast.message === message) { // Only hide if message hasn't changed
                this.toast.visible = false;
            }
        }, 5000);
    }

    hideToast(): void {
        this.toast.visible = false;
    }

    setSyncStatus(status: SyncStatus, message?: string): void {
        this.syncStatus = status;
        if (message && status === 'error') {
            this.showToast(message, 'error');
        } else if (status === 'synced') {
            this.hideToast();
        }
    }

    /** Set the cursor-highlighted block (visual only, does not affect selection) */
    setCursorHighlight(id: string | null): void {
        this.cursorHighlightId = id;
    }

    setFileName(name: string): void {
        this.fileName = name;
    }
}

export const uiState = new UIStateStore();
