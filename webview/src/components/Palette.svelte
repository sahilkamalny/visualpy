<script lang="ts">
    import {
        PALETTE_CATEGORIES,
        BLOCK_COLORS,
        type BlockCategory,
    } from "../lib/types";
    import { blockStore } from "../lib/stores/blockStore.svelte";
    import { uiState } from "../lib/stores/uiState.svelte";
    import { dragState } from "../lib/stores/dragState.svelte";

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

    /** Show trash zone when dragging an existing canvas block (not palette-initiated) */
    const showTrash = $derived(
        dragState.data.phase === "dragging" && !dragState.data.fromPalette,
    );

    /** Whether the pointer is hovering over the trash zone */
    const trashHover = $derived(dragState.data.overTrash);

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
    class:trash-mode={showTrash}
    role="complementary"
    aria-label={showTrash ? "Trash zone" : "Block palette"}
>
    <!-- Normal palette content (hidden during trash mode) -->
    {#if !showTrash}
        <div class="vp-palette-header">
            <span class="vp-palette-title">Block Library</span>
            <button
                class="vp-palette-collapse-btn"
                onclick={() => uiState.togglePalette()}
                title="Collapse Sidebar"
            >
                ‹
            </button>
        </div>

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
                            class:expanded={expandedCategories.has(
                                category.name,
                            )}>›</span
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
                                    <span class="vp-palette-icon"
                                        >{item.icon}</span
                                    >
                                    <span class="vp-palette-label"
                                        >{item.name}</span
                                    >
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {:else}
        <!-- Trash zone (shown during canvas-block drags) -->
        <div class="vp-trash-zone" class:hover={trashHover}>
            <div class="vp-trash-icon-container" class:hover={trashHover}>
                <span class="vp-trash-icon">🗑️</span>
            </div>
            <span class="vp-trash-label"
                >{trashHover
                    ? "Release to delete"
                    : "Drag here to delete"}</span
            >
        </div>
    {/if}

    <!-- Poking out button when collapsed -->
    <button
        class="vp-palette-expand-btn"
        onclick={() => uiState.togglePalette()}
        title="Expand Sidebar"
        aria-hidden={!uiState.paletteCollapsed}
    >
        ››
    </button>
</div>

<style>
    .vp-palette {
        width: 240px; /* Slightly wider for better readability */
        min-width: 240px;
        background: var(--vp-bg);
        border-right: 1px solid var(--vp-border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
        transition:
            width 200ms ease,
            min-width 200ms ease,
            background 300ms ease,
            border-color 300ms ease;
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

    /* Trash mode: red-tinted background */
    .vp-palette.trash-mode {
        background: linear-gradient(
            180deg,
            color-mix(in srgb, #ef4444 8%, var(--vp-bg)) 0%,
            color-mix(in srgb, #ef4444 15%, var(--vp-bg)) 100%
        );
        border-right-color: color-mix(in srgb, #ef4444 30%, var(--vp-border));
    }

    .vp-palette-header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--vp-border);
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--vp-bg);
    }

    .vp-palette-title {
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--vp-fg);
        opacity: 0.7;
        flex: 1;
        margin: 0;
    }

    /* Collapse button in header */
    .vp-palette-collapse-btn {
        background: none;
        border: none;
        color: var(--vp-fg);
        opacity: 0.5;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--vp-transition-fast);
    }
    .vp-palette-collapse-btn:hover {
        opacity: 1;
        background: var(--vp-hover);
    }

    /* Expand button poking out */
    .vp-palette-expand-btn {
        position: absolute;
        left: 0;
        top: 12px;
        z-index: 100;
        background: var(--vp-bg);
        border: 1px solid var(--vp-border);
        border-left: none; /* Make it look attached */
        border-radius: 0 4px 4px 0;
        width: 24px;
        height: 32px;
        display: none; /* Hidden by default */
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: var(--vp-fg);
        font-size: 16px;
        box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1);
    }
    .vp-palette-expand-btn:hover {
        background: var(--vp-hover);
    }

    .vp-palette.collapsed .vp-palette-expand-btn {
        display: flex; /* Show only when collapsed */
    }

    .vp-palette-search {
        padding: 12px 16px 12px;
        position: relative;
    }

    .vp-search-input {
        width: 100%;
        padding: 6px 10px;
        font-family: inherit;
        font-size: 12px;
        background: var(--vp-input-bg);
        color: var(--vp-input-fg);
        border: 1px solid transparent; /* Cleaner look */
        border-radius: var(--vp-radius-sm);
        transition: all var(--vp-transition-fast);
    }
    .vp-search-input:focus {
        background: var(--vp-input-bg);
        border-color: var(--vp-focus);
        box-shadow: 0 0 0 1px var(--vp-focus);
    }
    .vp-search-input::placeholder {
        opacity: 0.4;
    }

    .vp-search-clear {
        position: absolute;
        right: 24px;
        top: 6px; /* Adjusted for new padding */
        background: none;
        border: none;
        color: var(--vp-fg);
        opacity: 0.4;
        cursor: pointer;
        font-size: 12px;
        padding: 6px;
    }
    .vp-search-clear:hover {
        opacity: 0.8;
    }

    .vp-palette-list {
        flex: 1;
        overflow-y: auto;
        padding: 0 0 16px;
    }

    .vp-palette-category {
        margin-bottom: 2px;
    }

    .vp-palette-category-header {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 16px;
        background: none;
        border: none;
        color: var(--vp-fg);
        cursor: pointer;
        font-family: inherit;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        opacity: 0.8;
        letter-spacing: 0.5px;
        transition: background var(--vp-transition-fast);
        user-select: none;
    }
    .vp-palette-category-header:hover {
        background: var(--vp-hover);
        opacity: 1;
    }

    .vp-category-indicator {
        width: 6px;
        height: 6px;
        border-radius: 50%; /* Dot instead of square */
        background: var(--cat-color);
        flex-shrink: 0;
        opacity: 0.8;
    }

    .vp-category-name {
        flex: 1;
        text-align: left;
    }

    .vp-category-chevron {
        font-size: 12px;
        opacity: 0.4;
        transition: transform var(--vp-transition);
        transform: rotate(0deg);
    }
    .vp-category-chevron.expanded {
        transform: rotate(90deg);
    }

    .vp-palette-items {
        padding: 4px 12px 8px 24px; /* Indented more */
        display: flex;
        flex-direction: column;
        gap: 4px;
        animation: vp-slide-down 150ms ease;
    }

    .vp-palette-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 10px;
        border-radius: var(--vp-radius-sm);
        cursor: grab;
        border: 1px solid transparent;
        transition: all var(--vp-transition-fast);
        background: transparent;
        font-size: 12px;
        user-select: none;
        -webkit-user-select: none;
        position: relative;
        overflow: hidden;
    }

    /* Accent strip on hover */
    .vp-palette-item::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--block-color);
        opacity: 0;
        transition: opacity var(--vp-transition-fast);
    }

    .vp-palette-item:hover {
        background: var(--vp-hover);
    }
    .vp-palette-item:hover::before {
        opacity: 1;
    }

    .vp-palette-item:active {
        transform: scale(0.98);
        cursor: grabbing;
    }

    .vp-palette-icon {
        font-size: 14px;
        width: 18px;
        text-align: center;
        flex-shrink: 0;
        opacity: 0.7;
        color: var(--block-color);
    }
    .vp-palette-item:hover .vp-palette-icon {
        opacity: 1;
    }

    .vp-palette-label {
        font-size: 12px;
        flex: 1;
        opacity: 0.9;
    }

    /* ============================================
       Trash Zone Styles
       ============================================ */

    .vp-trash-zone {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        animation: vp-fade-in 200ms ease;
        user-select: none;
        pointer-events: none; /* Hit-testing handled by DragController */
    }

    .vp-trash-icon-container {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(
            135deg,
            rgba(239, 68, 68, 0.15) 0%,
            rgba(239, 68, 68, 0.25) 100%
        );
        border: 2px solid rgba(239, 68, 68, 0.3);
        transition:
            transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1),
            background 200ms ease,
            border-color 200ms ease,
            box-shadow 200ms ease;
        animation: vp-trash-pulse 2s ease-in-out infinite;
    }

    .vp-trash-icon-container.hover {
        animation: vp-trash-bounce-in 400ms cubic-bezier(0.34, 1.56, 0.64, 1)
            forwards;
        background: linear-gradient(
            135deg,
            rgba(239, 68, 68, 0.3) 0%,
            rgba(239, 68, 68, 0.45) 100%
        );
        border-color: rgba(239, 68, 68, 0.6);
        box-shadow: 0 0 30px rgba(239, 68, 68, 0.3);
    }

    /* When leaving hover, play bounce-out */
    .vp-trash-icon-container:not(.hover) {
        animation:
            vp-trash-bounce-out 350ms cubic-bezier(0.25, 0.46, 0.45, 0.94)
                forwards,
            vp-trash-pulse 2s ease-in-out 350ms infinite;
    }

    .vp-trash-icon {
        font-size: 36px;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    }

    .vp-trash-label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #ef4444;
        opacity: 0.8;
        transition: opacity 200ms ease;
    }

    .vp-trash-zone.hover .vp-trash-label {
        opacity: 1;
    }
</style>
