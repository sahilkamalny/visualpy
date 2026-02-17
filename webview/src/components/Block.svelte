<script lang="ts">
    import type { Block } from "../lib/types";
    import { BLOCK_COLORS, BLOCK_ICONS } from "../lib/types";
    import { blockStore } from "../lib/stores/blockStore.svelte";
    import { uiState } from "../lib/stores/uiState.svelte";
    import { dragState } from "../lib/stores/dragState.svelte";
    import { getBlockLabel, debounce } from "../lib/utils";
    import { send } from "../lib/bridge";

    interface Props {
        block: Block;
        depth?: number;
    }

    let { block, depth = 0 }: Props = $props();

    const colors = $derived(BLOCK_COLORS[block.category] || BLOCK_COLORS.misc);
    const icon = $derived(BLOCK_ICONS[block.type] || "📦");
    const isSelected = $derived(uiState.selectedBlockIds.includes(block.id));
    const isCursorHighlighted = $derived(
        uiState.cursorHighlightId === block.id,
    );

    const hasChildren = $derived(!!block.children && block.children.length > 0);
    const isCollapsed = $derived(block.metadata?.collapsed ?? false);
    const hasError = $derived(!!block.metadata?.error);

    function handleSelect(e: MouseEvent) {
        e.stopPropagation();
        // Ensure webview takes keyboard focus away from other VS Code panels
        window.focus();

        // Hide context menu if open
        uiState.hideContextMenu();

        // Toggle this block in the selection set.
        uiState.toggleBlockSelection(block.id);

        // Notify host for code highlighting
        if (block.metadata?.sourceRange) {
            send({
                type: "BLOCK_SELECTED",
                payload: {
                    blockId: block.id,
                    sourceRange: {
                        startLine: block.metadata.sourceRange.startLine,
                        endLine: block.metadata.sourceRange.endLine,
                    },
                },
            });
        }
    }

    function handleContextMenu(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        // Just show the menu. Do NOT select the block.
        uiState.showContextMenu(e.clientX, e.clientY, block.id);
    }

    function handleToggleCollapse(e: MouseEvent) {
        e.stopPropagation();
        blockStore.toggleCollapse(block.id);
    }

    // --- Debounced flush: propagates quiet field mutations to the reactive store ---
    // 300ms delay keeps the store in sync without clobbering the DOM mid-keystroke.
    const debouncedFlush = debounce(() => {
        blockStore.flushFieldUpdate();
    }, 300);

    function handleFieldInput(fieldId: string, e: Event) {
        const target = e.target as HTMLInputElement;
        // Quietly mutate the field value without triggering a reactive re-render.
        // This lets the DOM <input> keep its own state during rapid typing.
        blockStore.updateFieldQuiet(block.id, fieldId, target.value);
        // Schedule a deferred store flush so the $effect in App.svelte
        // picks up the change after a 300ms typing pause.
        debouncedFlush();
    }

    // --- Field focus/blur for undo history ---
    // Save old value on focus; push undo on blur only if changed.
    let fieldFocusValue = "";

    function handleFieldFocus(fieldId: string, e: FocusEvent) {
        e.stopPropagation();
        const target = e.target as HTMLInputElement;
        fieldFocusValue = target.value;
        // Mark this field as actively being edited so reconcileBlocks
        // won't overwrite its value during sync roundtrips.
        blockStore.activeEditField = { blockId: block.id, fieldId };
        // Save current blocks state for undo (before any typing)
        blockStore.saveSnapshot();
    }

    function handleFieldBlur(e: FocusEvent) {
        const newVal = (e.target as HTMLInputElement).value;
        // Clear the active edit guard — reconcileBlocks may now overwrite freely.
        blockStore.activeEditField = null;
        // Immediately flush any pending quiet mutations so the store is up-to-date.
        blockStore.flushFieldUpdate();
        if (newVal !== fieldFocusValue) {
            // Value changed during this focus session — the snapshot is
            // already saved, so the next mutation auto-committed it.
            // No further action needed.
        } else {
            // Value unchanged — discard the snapshot we saved on focus
            blockStore.discardSnapshot();
        }
    }
</script>

<div
    class="vp-block"
    class:selected={isSelected}
    class:cursor-highlight={isCursorHighlighted}
    class:has-error={hasError}
    data-block-id={block.id}
    data-block-type={block.type}
    style="--block-color: {colors.primary}; --block-accent: {colors.accent}; --depth: {depth};"
    role="treeitem"
    tabindex="0"
    aria-selected={isSelected}
    aria-expanded={hasChildren ? !isCollapsed : undefined}
    onclick={handleSelect}
    oncontextmenu={handleContextMenu}
>
    <!-- Left Accent Strip -->
    <div class="vp-accent-strip"></div>

    <div class="vp-block-content">
        <!-- Block Header (drag handle) -->
        <div class="vp-block-header">
            <div class="vp-block-grip" title="Drag to reorder">⋮⋮</div>
            <span class="vp-block-icon">{icon}</span>
            <span class="vp-block-type">{block.type}</span>

            <!-- Editable fields inline in header (for simple blocks) -->
            {#if block.content.editable && block.content.editable.length > 0}
                <div class="vp-block-fields">
                    {#each block.content.editable as field (field.id)}
                        <input
                            type="text"
                            class="vp-field-input"
                            value={field.value}
                            placeholder={field.placeholder || field.label}
                            title={field.label}
                            oninput={(e) => handleFieldInput(field.id, e)}
                            onfocus={(e) => handleFieldFocus(field.id, e)}
                            onblur={handleFieldBlur}
                            onkeydown={(e) => e.stopPropagation()}
                            onclick={(e) => e.stopPropagation()}
                        />
                    {/each}
                </div>
            {/if}

            <!-- Collapse toggle (for compound blocks) -->
            {#if block.children !== undefined}
                <button
                    class="vp-collapse-btn"
                    class:collapsed={isCollapsed}
                    title={isCollapsed ? "Expand" : "Collapse"}
                    onclick={handleToggleCollapse}
                >
                    <span class="vp-chevron">›</span>
                </button>
            {/if}

            {#if hasError}
                <span class="vp-block-error" title={block.metadata.error}
                    >⚠</span
                >
            {/if}
        </div>

        <!-- Children (compound blocks like if, for, def) -->
        {#if block.children !== undefined && !isCollapsed}
            <div class="vp-block-children" data-children-of={block.id}>
                {#if block.children.length > 0}
                    {#each block.children as child (child.id)}
                        <svelte:self block={child} depth={depth + 1} />
                    {/each}
                {:else}
                    <div class="vp-block-empty">
                        <span class="vp-empty-text">Drop blocks here</span>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<!-- Attachments (elif, else, except, finally) -->
{#if block.attachments && block.attachments.length > 0 && !isCollapsed}
    <div class="vp-block-attachments">
        {#each block.attachments as attachment (attachment.id)}
            <svelte:self block={attachment} {depth} />
        {/each}
    </div>
{/if}

<style>
    .vp-block {
        display: flex; /* Flex to hold accent strip and content side-by-side */
        position: relative;
        border-radius: var(--vp-radius);
        background: var(--vp-bg); /* Use solid background for cleanliness */
        border: 1px solid var(--vp-border);
        box-shadow: var(--vp-shadow-sm);
        margin: 4px 0;
        transition:
            box-shadow var(--vp-transition-fast),
            border-color var(--vp-transition-fast),
            transform var(--vp-transition);
        cursor: default;
        animation: vp-scale-in 200ms ease backwards;
        overflow: hidden; /* contain the accent strip */
        /* Force hardware acceleration/layer promotion to match highlighted state */
        transform: translateZ(0);
        will-change: transform;
    }

    .vp-block:not(.selected):hover {
        border-color: var(
            --block-color
        ); /* Subtle hover highlight matching block color */
        box-shadow: var(--vp-shadow-md);
        z-index: 1; /* Slight lift */
    }

    /* Base selected state (only when NOT cursor-highlighted) */
    .vp-block.selected {
        border-color: var(--block-color);
        --selected-shadow: 0 0 0 1px var(--block-color),
            0 0 15px 1px color-mix(in srgb, var(--block-color) 30%, transparent);
        /* Slightly weaker shadow for indented state to compensate for perceptual intensity */
        --selected-shadow-indented: 0 0 0 1px var(--block-color),
            0 0 15px 1px transparent;
        box-shadow: var(--selected-shadow);
        z-index: 2;
    }

    /* Selected state: Wider accent strip */
    .vp-block.selected > .vp-accent-strip {
        width: 6px;
        box-shadow: 0 0 8px var(--block-color);
    }

    /* Selected state: Header highlight gradient */
    .vp-block.selected > .vp-block-content > .vp-block-header {
        background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--block-color) 15%, transparent) 0%,
            transparent 100%
        );
    }

    .vp-block.has-error {
        border-color: #ef4444;
        background: color-mix(in srgb, #ef4444 5%, var(--vp-bg));
    }

    /* Cursor-highlight state: smooth indent to show active block */
    .vp-block.cursor-highlight {
        transform: translateX(12px);
        border-color: color-mix(in srgb, var(--block-color) 60%, transparent);
        box-shadow: var(--vp-shadow-md);
        z-index: 1;
    }
    .vp-block.cursor-highlight > .vp-accent-strip {
        width: 5px;
        box-shadow: 0 0 8px
            color-mix(in srgb, var(--block-color) 40%, transparent);
    }

    /* FIX: Ensure transform applies even when selected */
    /* FIX: Ensure transform applies even when selected */
    /* FIX: Ensure transform applies even when selected */
    .vp-block.selected.cursor-highlight {
        transform: translateX(12px);
        /* Match selected z-index exactly to prevent shadow popping over neighbors */
        z-index: 2;
        /* Use the slightly weaker shadow to match perception */
        box-shadow: var(--selected-shadow-indented);
    }

    /* FIX: Ensure accent strip retains selected width/glow when highlighted */
    .vp-block.selected.cursor-highlight > .vp-accent-strip {
        width: 6px;
        box-shadow: 0 0 8px var(--block-color);
    }

    /* Accent Strip */
    .vp-accent-strip {
        width: 4px;
        background: var(--block-color);
        flex-shrink: 0;
        transition: width var(--vp-transition-fast);
    }

    /* Content Wrapper */
    .vp-block-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }

    /* Block Header */
    .vp-block-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        min-height: 40px;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        border-bottom: 1px solid transparent; /* Reserve space for border */
    }
    .vp-block-header:active {
        cursor: grabbing;
    }

    /* Only show bottom border if we have children expanded */
    .vp-block:has(.vp-block-children) .vp-block-header {
        border-bottom-color: var(--vp-border);
    }

    /* Fallback for browsers not supporting :has() - we can leave it transparent or use JS classes.
       For VS Code (Electron), :has is supported. */

    .vp-block-grip {
        font-size: 14px;
        color: var(--vp-fg);
        opacity: 0.3;
        letter-spacing: 0;
        margin-right: -2px;
        cursor: grab;
    }
    .vp-block:hover .vp-block-grip {
        opacity: 0.6;
    }

    .vp-block-icon {
        font-size: 15px;
        color: var(--block-color);
        opacity: 0.9;
    }

    .vp-block-type {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--vp-fg);
        opacity: 0.8;
    }

    /* Editable fields */
    .vp-block-fields {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
        min-width: 0;
        margin-left: 4px;
    }

    .vp-field-input {
        flex: 1;
        min-width: 60px;
        padding: 4px 8px;
        font-family: var(--vp-code);
        font-size: 12px;
        background: var(--vp-input-bg);
        color: var(--vp-input-fg);
        border: 1px solid transparent;
        border-radius: var(--vp-radius-sm);
        transition:
            border-color var(--vp-transition-fast),
            background var(--vp-transition-fast);
    }
    .vp-field-input:hover {
        border-color: var(--vp-input-border);
    }
    .vp-field-input:focus {
        background: var(--vp-input-bg);
        border-color: var(--vp-focus);
        box-shadow: 0 0 0 1px var(--vp-focus);
    }
    .vp-field-input::placeholder {
        opacity: 0.4;
    }

    /* Collapse toggle */
    .vp-collapse-btn {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: var(--vp-fg);
        opacity: 0.4;
        cursor: pointer;
        border-radius: 4px;
        transition: all var(--vp-transition-fast);
        margin-left: auto;
    }
    .vp-collapse-btn:hover {
        opacity: 1;
        background: var(--vp-hover);
    }
    .vp-chevron {
        display: inline-block;
        transition: transform var(--vp-transition);
        transform: rotate(90deg);
        font-size: 12px;
    }
    .vp-collapse-btn.collapsed .vp-chevron {
        transform: rotate(0deg);
    }

    .vp-block-error {
        color: #ef4444;
        font-size: 14px;
        flex-shrink: 0;
        margin-left: 8px;
    }

    /* Children container */
    .vp-block-children {
        padding: 4px 0 4px 18px;
        position: relative;
    }
    .vp-block-children::before {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 8px; /* Aligned with parent's accent strip or icon */
        width: 1px;
        background: var(--vp-border);
    }

    .vp-block-empty {
        padding: 6px 10px;
        text-align: left;
        opacity: 0.4;
        font-size: 11px;
        font-style: italic;
        margin: 2px 0;
        color: var(--vp-fg);
    }

    /* Attachments */
    .vp-block-attachments {
        /* No margin/padding tweak needed if we treat them as siblings */
        margin-top: 2px;
    }
</style>
