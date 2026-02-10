<script lang="ts">
    import { blockStore } from "../lib/stores/blockStore.svelte";
    import { uiState } from "../lib/stores/uiState.svelte";
    import { send } from "../lib/bridge";

    function handleSave() {
        uiState.setSyncStatus("syncing");
        send({
            type: "REQUEST_SYNC",
            payload: { direction: "toCode", blocks: blockStore.blocks },
        });
    }

    function handleUndo() {
        blockStore.undo();
    }
    function handleRedo() {
        blockStore.redo();
    }
    function handleDelete() {
        if (uiState.selectedBlockId) {
            blockStore.removeBlock(uiState.selectedBlockId);
            uiState.selectBlock(null);
        }
    }
    function toggleAutoSave() {
        uiState.autoSave = !uiState.autoSave;
    }
    function handleCollapseAll() {
        for (const block of blockStore.blocks) {
            setCollapsedRecursive(block, true);
        }
        blockStore.blocks = [...blockStore.blocks];
    }
    function handleExpandAll() {
        for (const block of blockStore.blocks) {
            setCollapsedRecursive(block, false);
        }
        blockStore.blocks = [...blockStore.blocks];
    }
    function setCollapsedRecursive(block: any, collapsed: boolean) {
        if (block.children && block.children.length > 0) {
            block.metadata.collapsed = collapsed;
            block.children.forEach((c: any) =>
                setCollapsedRecursive(c, collapsed),
            );
        }
    }

    const syncLabel = $derived(
        uiState.syncStatus === "synced"
            ? "Synced"
            : uiState.syncStatus === "syncing"
              ? "Syncing..."
              : uiState.syncStatus === "pending"
                ? "Pending..."
                : "Error",
    );

    const syncClass = $derived(
        uiState.syncStatus === "synced"
            ? "synced"
            : uiState.syncStatus === "error"
              ? "error"
              : "pending",
    );
</script>

<div class="vp-toolbar" role="toolbar" aria-label="Block editor toolbar">
    <!-- File info -->
    <div class="vp-toolbar-section">
        <span class="vp-filename">{uiState.fileName}</span>
        <span class="vp-sync-indicator {syncClass}">
            <span class="vp-sync-dot"></span>
            <span class="vp-sync-text">{syncLabel}</span>
        </span>
    </div>

    <!-- Actions -->
    <div class="vp-toolbar-section vp-toolbar-center">
        <button
            class="vp-btn vp-btn-icon"
            title="Undo (Ctrl+Z)"
            disabled={!blockStore.canUndo}
            onclick={handleUndo}>↶</button
        >
        <button
            class="vp-btn vp-btn-icon"
            title="Redo (Ctrl+Y)"
            disabled={!blockStore.canRedo}
            onclick={handleRedo}>↷</button
        >

        <span class="vp-toolbar-divider"></span>

        <button
            class="vp-btn vp-btn-icon"
            title="Delete Selected (Del)"
            onclick={handleDelete}>🗑️</button
        >
        <button
            class="vp-btn vp-btn-icon"
            title="Collapse All"
            onclick={handleCollapseAll}>⊟</button
        >
        <button
            class="vp-btn vp-btn-icon"
            title="Expand All"
            onclick={handleExpandAll}>⊞</button
        >

        <span class="vp-toolbar-divider"></span>

        <button
            class="vp-btn vp-btn-icon"
            title="Zoom Out"
            onclick={() => uiState.zoomOut()}>−</button
        >
        <span class="vp-zoom-label">{uiState.zoomLevel}%</span>
        <button
            class="vp-btn vp-btn-icon"
            title="Zoom In"
            onclick={() => uiState.zoomIn()}>+</button
        >
        <button
            class="vp-btn vp-btn-sm"
            title="Reset Zoom"
            onclick={() => uiState.resetZoom()}>Reset</button
        >
    </div>

    <!-- Right actions -->
    <div class="vp-toolbar-section vp-toolbar-right">
        <label class="vp-auto-save-toggle" title="Auto-save changes to code">
            <input
                type="checkbox"
                checked={uiState.autoSave}
                onchange={toggleAutoSave}
            />
            <span class="vp-toggle-track">
                <span class="vp-toggle-thumb"></span>
            </span>
            <span class="vp-toggle-label">Auto Save</span>
        </label>
        <button class="vp-btn vp-btn-primary" onclick={handleSave}>
            Save to Code
        </button>
    </div>
</div>

<style>
    .vp-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px;
        background: color-mix(in srgb, var(--vp-bg) 95%, white 5%);
        border-bottom: 1px solid var(--vp-border);
        gap: 12px;
        flex-shrink: 0;
        min-height: 44px;
        z-index: 10;
    }

    .vp-toolbar-section {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .vp-toolbar-center {
        flex: 1;
        justify-content: center;
    }

    .vp-toolbar-right {
        justify-content: flex-end;
    }

    .vp-toolbar-divider {
        width: 1px;
        height: 20px;
        background: var(--vp-border);
        margin: 0 4px;
    }

    .vp-filename {
        font-weight: 600;
        font-size: 12px;
        opacity: 0.8;
        max-width: 160px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Sync indicator */
    .vp-sync-indicator {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.06);
    }
    .vp-sync-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #888;
        transition: background var(--vp-transition);
    }
    .vp-sync-indicator.synced .vp-sync-dot {
        background: #34d399;
    }
    .vp-sync-indicator.pending .vp-sync-dot {
        background: #fbbf24;
        animation: vp-pulse 1s infinite;
    }
    .vp-sync-indicator.error .vp-sync-dot {
        background: #f87171;
    }

    /* Buttons */
    .vp-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: var(--vp-radius-sm);
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
        transition: all var(--vp-transition-fast);
        color: var(--vp-fg);
        background: transparent;
    }
    .vp-btn:hover:not(:disabled) {
        background: var(--vp-hover);
    }
    .vp-btn:active:not(:disabled) {
        transform: scale(0.95);
    }
    .vp-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }
    .vp-btn-icon {
        width: 30px;
        height: 30px;
        font-size: 15px;
        border-radius: 8px;
    }
    .vp-btn-sm {
        padding: 3px 8px;
        font-size: 11px;
        opacity: 0.7;
    }
    .vp-btn-primary {
        background: var(--vp-button-bg);
        color: var(--vp-button-fg);
        padding: 5px 14px;
        font-weight: 500;
    }
    .vp-btn-primary:hover:not(:disabled) {
        background: var(--vp-button-hover);
    }

    .vp-zoom-label {
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        min-width: 36px;
        text-align: center;
        opacity: 0.7;
    }

    /* Auto-save toggle */
    .vp-auto-save-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        font-size: 12px;
    }
    .vp-auto-save-toggle input {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
    }
    .vp-toggle-track {
        width: 34px;
        height: 18px;
        border-radius: 9px;
        background: rgba(255, 255, 255, 0.12);
        position: relative;
        transition: background var(--vp-transition);
    }
    .vp-auto-save-toggle input:checked + .vp-toggle-track {
        background: var(--vp-button-bg);
    }
    .vp-toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: white;
        transition: transform var(--vp-transition);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    .vp-auto-save-toggle input:checked + .vp-toggle-track .vp-toggle-thumb {
        transform: translateX(16px);
    }
    .vp-toggle-label {
        opacity: 0.7;
        font-size: 11px;
    }
</style>
