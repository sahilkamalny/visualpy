<script lang="ts">
    import { uiState } from "../lib/stores/uiState.svelte";
    import { blockStore } from "../lib/stores/blockStore.svelte";
    import { deepClone, generateId } from "../lib/utils";

    // Helper to get target blocks:
    // If target block is in selection, use selection.
    // If target block is NOT in selection (or no selection), use just the target block.
    function getTargetIds(): string[] {
        const targetId = uiState.contextMenu.blockId;
        if (!targetId) return [];

        if (uiState.selectedBlockIds.includes(targetId)) {
            return [...uiState.selectedBlockIds];
        }
        return [targetId];
    }

    function handleCopy() {
        const ids = getTargetIds();
        if (ids.length === 0) return;
        const blocks = ids
            .map((id) => blockStore.findBlock(id))
            .filter(Boolean);
        // Use JSON serialization to ensure we store plain data, not Svelte proxies
        uiState.clipboard = JSON.parse(JSON.stringify(blocks));
        uiState.hideContextMenu();
    }

    function handlePaste() {
        if (!uiState.clipboard) return;
        const items = Array.isArray(uiState.clipboard)
            ? uiState.clipboard
            : [uiState.clipboard];
        const targetId = uiState.contextMenu.blockId;
        const clones = items.map((item) => {
            const clone = JSON.parse(JSON.stringify(item));
            reId(clone);
            return clone;
        });
        blockStore.insertBlocks(clones, targetId);
        uiState.hideContextMenu();
    }

    function handleDuplicate() {
        const ids = getTargetIds();
        if (ids.length === 0) return;
        if (ids.length === 0) return;
        blockStore.duplicateBlocks(ids);
        uiState.hideContextMenu();
    }

    function handleDelete() {
        const ids = getTargetIds();
        if (ids.length === 0) return;
        blockStore.removeBlocks(ids);
        uiState.clearSelection();
        uiState.hideContextMenu();
    }

    function reId(block: any) {
        block.id = generateId();
        if (block.children) block.children.forEach(reId);
        if (block.attachments) block.attachments.forEach(reId);
    }

    // Close on click outside
    function handleWindowClick() {
        if (uiState.contextMenu.visible) {
            uiState.hideContextMenu();
        }
    }
</script>

<svelte:window onclick={handleWindowClick} />

{#if uiState.contextMenu.visible}
    <div
        class="vp-context-menu"
        style="left: {uiState.contextMenu.x}px; top: {uiState.contextMenu.y}px;"
        role="menu"
        onclick={(e) => e.stopPropagation()}
    >
        <button class="vp-cm-item" role="menuitem" onclick={handleCopy}>
            <span class="vp-cm-icon">📋</span>
            <span>Copy</span>
            <span class="vp-cm-shortcut">Ctrl+C</span>
        </button>
        <button
            class="vp-cm-item"
            role="menuitem"
            onclick={handlePaste}
            disabled={!uiState.clipboard}
        >
            <span class="vp-cm-icon">📄</span>
            <span>Paste</span>
            <span class="vp-cm-shortcut">Ctrl+V</span>
        </button>
        <button class="vp-cm-item" role="menuitem" onclick={handleDuplicate}>
            <span class="vp-cm-icon">🔁</span>
            <span>Duplicate</span>
        </button>
        <div class="vp-cm-divider"></div>
        <button
            class="vp-cm-item vp-cm-danger"
            role="menuitem"
            onclick={handleDelete}
        >
            <span class="vp-cm-icon">🗑️</span>
            <span>Delete</span>
            <span class="vp-cm-shortcut">Del</span>
        </button>
    </div>
{/if}

<style>
    .vp-context-menu {
        position: fixed;
        z-index: 10001;
        min-width: 180px;
        background: color-mix(in srgb, var(--vp-bg) 95%, white 5%);
        border: 1px solid var(--vp-border);
        border-radius: var(--vp-radius);
        padding: 4px;
        box-shadow: var(--vp-shadow-lg);
        animation: vp-scale-in 100ms ease;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
    }

    .vp-cm-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 7px 10px;
        background: none;
        border: none;
        color: var(--vp-fg);
        font-family: inherit;
        font-size: 12px;
        cursor: pointer;
        border-radius: var(--vp-radius-sm);
        transition: background var(--vp-transition-fast);
        text-align: left;
    }
    .vp-cm-item:hover:not(:disabled) {
        background: var(--vp-hover);
    }
    .vp-cm-item:active:not(:disabled) {
        background: var(--vp-active);
    }
    .vp-cm-item:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }
    .vp-cm-item.vp-cm-danger:hover:not(:disabled) {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
    }

    .vp-cm-icon {
        font-size: 13px;
        width: 18px;
        text-align: center;
        flex-shrink: 0;
    }

    .vp-cm-shortcut {
        margin-left: auto;
        font-size: 10px;
        opacity: 0.4;
        font-family: var(--vp-mono);
    }

    .vp-cm-divider {
        height: 1px;
        background: var(--vp-border);
        margin: 4px 6px;
    }
</style>
