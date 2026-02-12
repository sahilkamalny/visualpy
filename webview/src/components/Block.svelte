<script lang="ts">
    import type { Block } from "../lib/types";
    import { BLOCK_COLORS, BLOCK_ICONS } from "../lib/types";
    import { blockStore } from "../lib/stores/blockStore.svelte";
    import { uiState } from "../lib/stores/uiState.svelte";
    import { dragState } from "../lib/stores/dragState.svelte";
    import { getBlockLabel } from "../lib/utils";
    import { send } from "../lib/bridge";

    interface Props {
        block: Block;
        depth?: number;
    }

    let { block, depth = 0 }: Props = $props();

    const colors = $derived(BLOCK_COLORS[block.category] || BLOCK_COLORS.misc);
    const icon = $derived(BLOCK_ICONS[block.type] || "📦");
    const isSelected = $derived(uiState.selectedBlockIds.includes(block.id));
    const isDragSource = $derived(
        dragState.data.phase !== "idle" && dragState.data.sourceId === block.id,
    );
    const hasChildren = $derived(!!block.children && block.children.length > 0);
    const isCollapsed = $derived(block.metadata?.collapsed ?? false);
    const hasError = $derived(!!block.metadata?.error);

    function handleSelect(e: MouseEvent) {
        e.stopPropagation();
        // Ensure webview takes keyboard focus away from other VS Code panels
        window.focus();
        // Toggle this block in the selection set.
        // Click adds/removes blocks from the selection.
        // Click on empty canvas area deselects all (handled in Canvas.svelte).
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
        // If block isn't already selected, select it
        if (!uiState.selectedBlockIds.includes(block.id)) {
            uiState.toggleBlockSelection(block.id);
        }
        uiState.showContextMenu(e.clientX, e.clientY, block.id);
    }

    function handleToggleCollapse(e: MouseEvent) {
        e.stopPropagation();
        blockStore.toggleCollapse(block.id);
    }

    function handleFieldInput(fieldId: string, e: Event) {
        const target = e.target as HTMLInputElement;
        blockStore.updateField(block.id, fieldId, target.value);
    }

    // --- Field focus/blur for undo history ---
    // Save old value on focus; push undo on blur only if changed.
    let fieldFocusValue = "";

    function handleFieldFocus(e: FocusEvent) {
        e.stopPropagation();
        fieldFocusValue = (e.target as HTMLInputElement).value;
        // Save current blocks state for undo (before any typing)
        blockStore.saveSnapshot();
    }

    function handleFieldBlur(e: FocusEvent) {
        const newVal = (e.target as HTMLInputElement).value;
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
    class:drag-source={isDragSource}
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
    <!-- Block Header (drag handle) -->
    <div class="vp-block-header">
        <div class="vp-block-grip" title="Drag to reorder">⠿</div>
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
                        onfocus={handleFieldFocus}
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
            <span class="vp-block-error" title={block.metadata.error}>⚠</span>
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

    <!-- Attachments (elif, else, except, finally) -->
    {#if block.attachments && block.attachments.length > 0 && !isCollapsed}
        <div class="vp-block-attachments">
            {#each block.attachments as attachment (attachment.id)}
                <svelte:self block={attachment} {depth} />
            {/each}
        </div>
    {/if}
</div>

<style>
    .vp-block {
        position: relative;
        border-radius: var(--vp-radius);
        border: 1.5px solid
            color-mix(in srgb, var(--block-color) 40%, transparent);
        background: color-mix(in srgb, var(--block-color) 8%, var(--vp-bg));
        margin: 3px 0;
        transition:
            border-color var(--vp-transition-fast),
            box-shadow var(--vp-transition-fast),
            transform var(--vp-transition);
        cursor: default;
        animation: vp-scale-in 200ms ease backwards;
        overflow: visible;
    }

    .vp-block:hover {
        border-color: color-mix(in srgb, var(--block-color) 60%, transparent);
        box-shadow: 0 2px 8px
            color-mix(in srgb, var(--block-color) 15%, transparent);
    }

    .vp-block.selected {
        border-color: var(--block-color);
        background: color-mix(in srgb, var(--block-color) 20%, var(--vp-bg));
        box-shadow:
            0 0 0 2px color-mix(in srgb, var(--block-color) 25%, transparent),
            0 4px 12px color-mix(in srgb, var(--block-color) 20%, transparent);
    }

    .vp-block.drag-source {
        opacity: 0.3;
        transform: scale(0.98);
    }

    .vp-block.has-error {
        border-color: #ef4444;
    }

    /* Block Header */
    .vp-block-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        min-height: 36px;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
    }
    .vp-block-header:active {
        cursor: grabbing;
    }

    .vp-block-grip {
        font-size: 11px;
        opacity: 0.2;
        letter-spacing: -2px;
        transition: opacity var(--vp-transition-fast);
        flex-shrink: 0;
    }
    .vp-block:hover .vp-block-grip {
        opacity: 0.5;
    }

    .vp-block-icon {
        font-size: 14px;
        flex-shrink: 0;
    }

    .vp-block-type {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        color: var(--block-color);
        flex-shrink: 0;
    }

    /* Editable fields */
    .vp-block-fields {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 1;
        min-width: 0;
    }

    .vp-field-input {
        flex: 1;
        min-width: 40px;
        padding: 2px 6px;
        font-family: var(--vp-mono);
        font-size: var(--vp-mono-size);
        background: color-mix(in srgb, var(--vp-input-bg) 80%, transparent);
        color: var(--vp-input-fg);
        border: 1px solid transparent;
        border-radius: 4px;
        outline: none;
        transition:
            border-color var(--vp-transition-fast),
            background var(--vp-transition-fast);
    }
    .vp-field-input:hover {
        background: var(--vp-input-bg);
        border-color: var(--vp-input-border);
    }
    .vp-field-input:focus {
        background: var(--vp-input-bg);
        border-color: var(--vp-focus);
        box-shadow: 0 0 0 1px
            color-mix(in srgb, var(--vp-focus) 30%, transparent);
    }
    .vp-field-input::placeholder {
        opacity: 0.35;
    }

    /* Collapse toggle */
    .vp-collapse-btn {
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        color: var(--vp-fg);
        opacity: 0.5;
        cursor: pointer;
        border-radius: 4px;
        transition: all var(--vp-transition-fast);
        flex-shrink: 0;
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
        font-size: 14px;
    }
    .vp-collapse-btn.collapsed .vp-chevron {
        transform: rotate(0deg);
    }

    .vp-block-error {
        color: #ef4444;
        font-size: 14px;
        flex-shrink: 0;
    }

    /* Children container */
    .vp-block-children {
        padding: 2px 8px 6px 20px;
        border-top: 1px solid
            color-mix(in srgb, var(--block-color) 15%, transparent);
        min-height: 20px;
        position: relative;
    }
    .vp-block-children::before {
        content: "";
        position: absolute;
        top: 4px;
        bottom: 4px;
        left: 12px;
        width: 2px;
        background: color-mix(in srgb, var(--block-color) 20%, transparent);
        border-radius: 1px;
    }

    .vp-block-empty {
        padding: 8px 12px;
        text-align: center;
        opacity: 0.3;
        font-size: 11px;
        font-style: italic;
        border: 1px dashed
            color-mix(in srgb, var(--block-color) 25%, transparent);
        border-radius: var(--vp-radius-sm);
        margin: 4px 0;
    }

    /* Attachments */
    .vp-block-attachments {
        padding: 0 0 0 0;
        margin-top: -3px;
    }
</style>
