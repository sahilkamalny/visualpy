<script lang="ts">
    import {
        PALETTE_CATEGORIES,
        BLOCK_COLORS,
        type BlockCategory,
    } from "../lib/types";
    import { blockStore } from "../lib/stores/blockStore.svelte";
    import { uiState } from "../lib/stores/uiState.svelte";

    let searchQuery = $state("");
    let expandedCategories = $state<Set<string>>(
        new Set(PALETTE_CATEGORIES.map((c) => c.name)),
    );

    const filteredCategories = $derived(
        PALETTE_CATEGORIES.map((cat) => ({
            ...cat,
            items: cat.items.filter(
                (item) =>
                    item.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                    item.type.toLowerCase().includes(searchQuery.toLowerCase()),
            ),
        })).filter((cat) => cat.items.length > 0),
    );

    function toggleCategory(name: string) {
        const next = new Set(expandedCategories);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        expandedCategories = next;
    }

    function getCategoryColor(name: string): {
        primary: string;
        accent: string;
    } {
        return BLOCK_COLORS[name as BlockCategory] || BLOCK_COLORS.misc;
    }

    function handlePaletteItemClick(type: string, category: string) {
        // Quick-add: clicking a palette item inserts it after the selected block
        const newBlock = blockStore.createBlockFromType(
            type as any,
            category as any,
        );
        blockStore.insertBlock(newBlock, uiState.selectedBlockId);
    }
</script>

<div
    class="vp-palette"
    class:collapsed={uiState.paletteCollapsed}
    role="complementary"
    aria-label="Block palette"
>
    <div class="vp-palette-header">
        <span class="vp-palette-title">Blocks</span>
        <div class="vp-palette-search">
            <input
                type="text"
                placeholder="Search blocks…"
                bind:value={searchQuery}
                class="vp-search-input"
                onkeydown={(e) => e.stopPropagation()}
            />
            {#if searchQuery}
                <button
                    class="vp-search-clear"
                    onclick={() => (searchQuery = "")}>✕</button
                >
            {/if}
        </div>
        <button
            class="vp-palette-collapse-btn"
            onclick={() => uiState.togglePalette()}
            title="Collapse Sidebar"
        >
            ‹‹
        </button>
    </div>

    <!-- Poking out button when collapsed -->
    <button
        class="vp-palette-expand-btn"
        onclick={() => uiState.togglePalette()}
        title="Expand Sidebar"
        aria-hidden={!uiState.paletteCollapsed}
    >
        ››
    </button>

    <div class="vp-palette-list">
        {#each filteredCategories as category (category.name)}
            {@const colors = getCategoryColor(category.name)}
            <div class="vp-palette-category">
                <button
                    class="vp-palette-category-header"
                    onclick={() => toggleCategory(category.name)}
                    style="--cat-color: {colors.primary};"
                >
                    <span class="vp-category-indicator"></span>
                    <span class="vp-category-name">{category.name}</span>
                    <span
                        class="vp-category-chevron"
                        class:expanded={expandedCategories.has(category.name)}
                        >›</span
                    >
                </button>

                {#if expandedCategories.has(category.name)}
                    <div class="vp-palette-items">
                        {#each category.items as item (item.type)}
                            <div
                                class="vp-palette-item"
                                draggable="false"
                                data-block-id={`palette-${item.type}`}
                                data-palette-type={item.type}
                                data-palette-category={category.name}
                                style="--block-color: {colors.primary}; --block-accent: {colors.accent};"
                                role="button"
                                tabindex="0"
                                title="Click to insert, or drag to canvas"
                                onclick={() =>
                                    handlePaletteItemClick(
                                        item.type,
                                        category.name,
                                    )}
                            >
                                <span class="vp-palette-icon">{item.icon}</span>
                                <span class="vp-palette-label">{item.name}</span
                                >
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    </div>
</div>

<style>
    .vp-palette {
        width: 220px;
        min-width: 220px;
        background: color-mix(in srgb, var(--vp-bg) 97%, white 3%);
        border-right: 1px solid var(--vp-border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
        transition:
            width 200ms ease,
            min-width 200ms ease;
    }

    .vp-palette.collapsed {
        width: 0;
        min-width: 0;
        border-right: none;
        overflow: visible; /* Allow expand button to poke out */
    }

    /* Hide children when collapsed to prevent layout issues */
    .vp-palette.collapsed > *:not(.vp-palette-expand-btn) {
        opacity: 0;
        pointer-events: none;
        transition: opacity 100ms ease;
    }

    .vp-palette-header {
        padding: 10px 12px;
        border-bottom: 1px solid var(--vp-border);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .vp-palette-title {
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.6;
        display: block;
        margin-bottom: 0; /* Adjusted from 8px to fit row */
        flex: 1;
    }

    /* Collapse button in header */
    .vp-palette-collapse-btn {
        background: none;
        border: none;
        color: var(--vp-fg);
        opacity: 0.6;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 0 4px;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .vp-palette-collapse-btn:hover {
        opacity: 1;
        background: var(--vp-hover);
    }

    /* Expand button poking out */
    .vp-palette-expand-btn {
        position: absolute;
        left: 0;
        top: 10px;
        z-index: 100;
        background: var(--vp-bg);
        border: 1px solid var(--vp-border);
        border-left: none; /* Make it look attached */
        border-radius: 0 6px 6px 0;
        width: 24px;
        height: 32px;
        display: none; /* Hidden by default */
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: var(--vp-fg);
        font-size: 18px;
        box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
    }
    .vp-palette-expand-btn:hover {
        background: var(--vp-hover);
    }

    .vp-palette.collapsed .vp-palette-expand-btn {
        display: flex; /* Show only when collapsed */
    }

    .vp-palette-search {
        position: relative;
        /* flex: 1;  Removed flex:1 so title can take space or share */
        width: 120px; /* Fixed width for search to fit title + btn */
    }

    .vp-search-input {
        width: 100%;
        padding: 5px 8px;
        font-family: inherit;
        font-size: 12px;
        background: var(--vp-input-bg);
        color: var(--vp-input-fg);
        border: 1px solid var(--vp-input-border);
        border-radius: var(--vp-radius-sm);
        cursor: text; /* Changed from grab */
        transition: border-color var(--vp-transition-fast);
    }
    .vp-search-input:focus {
        border-color: var(--vp-focus);
    }
    .vp-search-input::placeholder {
        opacity: 0.4;
    }

    .vp-search-clear {
        position: absolute;
        right: 4px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: var(--vp-fg);
        opacity: 0.5;
        cursor: pointer;
        font-size: 10px;
        padding: 2px 4px;
        border-radius: 3px;
    }
    .vp-search-clear:hover {
        opacity: 1;
        background: var(--vp-hover);
    }

    .vp-palette-list {
        flex: 1;
        overflow-y: auto;
        padding: 6px 0;
    }

    .vp-palette-category-header {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 6px 12px;
        background: none;
        border: none;
        color: var(--vp-fg);
        cursor: pointer;
        font-family: inherit;
        font-size: 11px;
        font-weight: 600;
        text-transform: capitalize;
        transition: background var(--vp-transition-fast);
    }
    .vp-palette-category-header:hover {
        background: var(--vp-hover);
    }

    .vp-category-indicator {
        width: 8px;
        height: 8px;
        border-radius: 3px;
        background: var(--cat-color);
        flex-shrink: 0;
    }

    .vp-category-name {
        flex: 1;
        text-align: left;
    }

    .vp-category-chevron {
        font-size: 14px;
        opacity: 0.5;
        transition: transform var(--vp-transition);
        transform: rotate(0deg);
    }
    .vp-category-chevron.expanded {
        transform: rotate(90deg);
    }

    .vp-palette-items {
        padding: 2px 8px 6px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        animation: vp-slide-down 150ms ease;
    }

    .vp-palette-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: var(--vp-radius-sm);
        cursor: grab;
        border: 1px solid transparent;
        transition: all var(--vp-transition-fast);
        background: transparent;
        font-size: 12px;
        user-select: none;
        -webkit-user-select: none;
    }
    .vp-palette-item:hover {
        background: color-mix(in srgb, var(--block-color) 15%, transparent);
        border-color: color-mix(in srgb, var(--block-color) 30%, transparent);
    }
    .vp-palette-item:active {
        transform: scale(0.97);
        cursor: grabbing;
    }

    .vp-palette-icon {
        font-size: 14px;
        width: 20px;
        text-align: center;
        flex-shrink: 0;
    }

    .vp-palette-label {
        font-size: 12px;
        flex: 1;
    }
</style>
