<script lang="ts">
    import { uiState } from "../lib/stores/uiState.svelte";
    import { blockStore } from "../lib/stores/blockStore.svelte";
    import { deepClone, generateId } from "../lib/utils";

    function handleCopy() {
        if (!uiState.contextMenu.blockId) return;
        const block = blockStore.findBlock(uiState.contextMenu.blockId);
        if (block) {
            uiState.clipboard = deepClone(block);
        }
        uiState.hideContextMenu();
    }

    function handlePaste() {
        if (!uiState.clipboard || !uiState.contextMenu.blockId) return;
        const clone = deepClone(uiState.clipboard) as any;
        reId(clone);
        blockStore.insertBlock(clone, uiState.contextMenu.blockId);
        uiState.hideContextMenu();
    }

    function handleDuplicate() {
        if (!uiState.contextMenu.blockId) return;
        blockStore.duplicateBlock(uiState.contextMenu.blockId);
        uiState.hideContextMenu();
    }

    function handleDelete() {
        if (!uiState.contextMenu.blockId) return;
        blockStore.removeBlock(uiState.contextMenu.blockId);
        uiState.selectBlock(null);
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
            <span>Paste After</span>
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
