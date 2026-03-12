<script lang="ts">
    import {
        PALETTE_CATEGORIES,
        BLOCK_COLORS,
        BLOCK_FLOW_ROLES,
        type BlockCategory,
        type BlockType,
        type FlowRole,
    } from "../lib/types";
    import { blockStore } from "../lib/stores/blockStore.svelte";
    import { uiState } from "../lib/stores/uiState.svelte";
    import { dragState } from "../lib/stores/dragState.svelte";

    let searchQuery = $state("");
    let expandedCategories = $state<Set<string>>(new Set());

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

    function getFlowRole(type: string): FlowRole {
        return BLOCK_FLOW_ROLES[type as BlockType] || "process";
    }

    // --- Resize handle (VS Code "sash" pattern) ---
    let resizeStartX = 0;
    let resizeStartWidth = 0;

    function onResizePointerDown(e: PointerEvent) {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);
        resizeStartX = e.clientX;
        resizeStartWidth = uiState.paletteWidth;
        uiState.isResizingPalette = true;
    }

    function onResizePointerMove(e: PointerEvent) {
        if (!uiState.isResizingPalette) return;
        const delta = e.clientX - resizeStartX;
        uiState.setPaletteWidth(resizeStartWidth + delta);
    }

    function onResizePointerUp(e: PointerEvent) {
        if (!uiState.isResizingPalette) return;
        const target = e.currentTarget as HTMLElement;
        target.releasePointerCapture(e.pointerId);
        uiState.isResizingPalette = false;
    }
</script>

<div
    class="vp-palette"
    class:collapsed={uiState.paletteCollapsed}
    class:trash-mode={showTrash}
    class:resizing={uiState.isResizingPalette}
    style="--palette-width: {uiState.paletteWidth}px;"
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
                                {@const role = getFlowRole(item.type)}
                                <div
                                    class="vp-palette-item"
                                    class:flow-process={role === "process"}
                                    class:flow-decision={role === "decision"}
                                    class:flow-loop={role === "loop"}
                                    class:flow-exception={role === "exception"}
                                    class:flow-terminal={role === "terminal"}
                                    class:flow-annotation={role === "annotation"}
                                    class:flow-data={role === "data"}
                                    class:flow-merge={role === "merge"}
                                    draggable="false"
                                    data-block-id={`palette-${item.type}`}
                                    data-palette-type={item.type}
                                    data-palette-category={category.name}
                                    data-flow-role={role}
                                    style="--block-color: {colors.primary}; --block-accent: {colors.accent};"
                                    role="button"
                                    tabindex="0"
                                    title="Click to insert, or drag to canvas"
                                    onclick={() =>
                                        handlePaletteItemClick(
                                            item.type,
                                            category.name,
                                        )}
                                    onkeydown={(e) => {
                                        if (e.key === "Enter" || e.key === " ")
                                            handlePaletteItemClick(
                                                item.type,
                                                category.name,
                                            );
                                    }}
                                >
                                    {#if uiState.showBlockIcons}
                                        <span class="vp-palette-icon"
                                            >{item.icon}</span
                                        >
                                    {/if}
                                    <span
                                        class="vp-palette-shape"
                                        class:process={role === "process"}
                                        class:decision={role === "decision"}
                                        class:loop={role === "loop"}
                                        class:exception={role === "exception"}
                                        class:terminal={role === "terminal"}
                                        class:annotation={role === "annotation"}
                                        class:data={role === "data"}
                                        class:merge={role === "merge"}
                                        aria-hidden="true"
                                    ></span>
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

    <!-- Resize handle (sash) -->
    {#if !uiState.paletteCollapsed && !showTrash}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="vp-palette-sash"
            onpointerdown={onResizePointerDown}
            onpointermove={onResizePointerMove}
            onpointerup={onResizePointerUp}
            onpointercancel={onResizePointerUp}
        ></div>
    {/if}
</div>

<style>
    .vp-palette {
        width: var(--palette-width, 160px);
        min-width: var(--palette-width, 160px);
        max-width: var(--palette-width, 160px);
        background: var(--vp-bg);
        border-right: 1px solid var(--vp-border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
        flex-shrink: 0;
        transition:
            width 700ms cubic-bezier(0.2, 0, 0, 1),
            min-width 700ms cubic-bezier(0.2, 0, 0, 1),
            max-width 700ms cubic-bezier(0.2, 0, 0, 1),
            background 300ms ease,
            border-color 300ms ease;
    }

    /* Disable transitions during active resize for responsiveness */
    .vp-palette.resizing {
        transition: none;
    }

    .vp-palette.collapsed {
        width: 0 !important;
        min-width: 0 !important;
        max-width: 0 !important;
        border-right: none;
        /* overflow stays hidden — allows close animation to clip cleanly */
        /* Opening transition (fires when this class is REMOVED = expanding): half the close speed */
        transition:
            width 350ms cubic-bezier(0.2, 0, 0, 1),
            min-width 350ms cubic-bezier(0.2, 0, 0, 1),
            max-width 350ms cubic-bezier(0.2, 0, 0, 1);
    }

    /* --- Resizable sash (VS Code pattern) --- */
    .vp-palette-sash {
        position: absolute;
        top: 0;
        right: -2px;
        width: 4px;
        height: 100%;
        cursor: col-resize;
        z-index: 10;
        transition: background 150ms ease;
    }

    .vp-palette-sash:hover,
    .vp-palette.resizing .vp-palette-sash {
        background: var(--vp-focus);
    }

    /* Children are clipped naturally by overflow:hidden as width slides to 0.
       No opacity rule needed — content stays visible throughout the animation. */
    .vp-palette.collapsed > * {
        pointer-events: none;
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
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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
        border: 1px solid
            color-mix(in srgb, var(--block-color) 30%, transparent);
        transition: all var(--vp-transition-fast);
        background: color-mix(in srgb, var(--block-color) 11%, transparent);
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
        width: 4px;
        background: var(--block-color);
        opacity: 0.6;
        transition: opacity var(--vp-transition-fast);
    }

    .vp-palette-item:hover {
        background: color-mix(
            in srgb,
            var(--block-color) 17%,
            var(--vp-hover)
        );
        border-color: color-mix(in srgb, var(--block-color) 65%, transparent);
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
        color: color-mix(in srgb, var(--block-color) 50%, var(--vp-fg));
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .vp-palette-shape {
        width: 10px;
        height: 10px;
        border: 1.5px solid
            color-mix(in srgb, var(--block-color) 78%, var(--vp-border));
        background: color-mix(in srgb, var(--block-color) 20%, transparent);
        border-radius: 2px;
        flex-shrink: 0;
        opacity: 0.92;
    }
    .vp-palette-shape.process {
        border-radius: 2px;
    }
    .vp-palette-shape.decision {
        transform: rotate(45deg);
        border-radius: 1px;
    }
    .vp-palette-shape.loop {
        width: 11px;
        height: 11px;
        border-radius: 50%;
        background: transparent;
        box-shadow: inset 0 0 0 1.5px
            color-mix(in srgb, var(--block-accent) 86%, transparent);
    }
    .vp-palette-shape.exception {
        clip-path: polygon(
            30% 0,
            70% 0,
            100% 30%,
            100% 70%,
            70% 100%,
            30% 100%,
            0 70%,
            0 30%
        );
    }
    .vp-palette-shape.terminal {
        width: 13px;
        border-radius: 999px;
    }
    .vp-palette-shape.annotation {
        clip-path: polygon(0 0, 88% 0, 100% 100%, 12% 100%);
    }
    .vp-palette-shape.data {
        clip-path: polygon(14% 0, 100% 0, 86% 100%, 0 100%);
        border-radius: 0;
    }
    .vp-palette-shape.merge {
        clip-path: polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%);
        border-radius: 1px;
    }

    .vp-palette-item.flow-decision {
        border-style: dashed;
    }

    .vp-palette-item.flow-loop::before {
        background: repeating-linear-gradient(
            180deg,
            var(--block-color) 0 3px,
            color-mix(in srgb, var(--block-accent) 88%, transparent) 3px 6px
        );
    }

    .vp-palette-item.flow-exception {
        border-style: dashed;
    }

    .vp-palette-item.flow-data {
        border-style: double;
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
