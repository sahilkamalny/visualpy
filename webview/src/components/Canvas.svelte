<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Block from "./Block.svelte";
    import { blockStore } from "../lib/stores/blockStore.svelte";
    import { uiState } from "../lib/stores/uiState.svelte";
    import { dragState } from "../lib/stores/dragState.svelte";
    import { DragController } from "../lib/drag/DragController";

    let canvasEl: HTMLElement;
    let scrollContainer: HTMLElement;
    let dragController: DragController | null = null;

    // Toggle body class for drag cursor
    $effect(() => {
        if (dragState.data.phase === "dragging") {
            document.body.classList.add("is-dragging");
        } else {
            document.body.classList.remove("is-dragging");
        }
    });

    onMount(() => {
        dragController = new DragController(canvasEl, scrollContainer);
        dragController.attach();
    });

    onDestroy(() => {
        dragController?.detach();
    });

    function handleCanvasClick(e: MouseEvent) {
        // Click on empty canvas area → deselect all
        const target = e.target as HTMLElement;
        if (target === canvasEl || target === scrollContainer) {
            uiState.clearSelection();
        }
    }

    function handleContextMenu(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (target === canvasEl || target === scrollContainer) {
            e.preventDefault();
            // Right-click on empty canvas
            uiState.hideContextMenu();
        }
    }

    const zoomTransform = $derived(`scale(${uiState.zoomLevel / 100})`);
</script>

<div
    class="vp-canvas-container"
    bind:this={scrollContainer}
    onclick={handleCanvasClick}
    oncontextmenu={handleContextMenu}
    role="tree"
    tabindex="0"
    aria-label="Block canvas"
>
    <div
        class="vp-canvas"
        bind:this={canvasEl}
        style="transform: {zoomTransform}; transform-origin: top left;"
    >
        {#if blockStore.blocks.length > 0}
            {#each blockStore.blocks as block (block.id)}
                <Block {block} />
            {/each}
        {:else}
            <div class="vp-canvas-empty">
                <div class="vp-empty-icon">🧩</div>
                <div class="vp-empty-title">No blocks yet</div>
                <div class="vp-empty-subtitle">
                    Drag blocks from the palette or open a Python file
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .vp-canvas-container {
        flex: 1;
        overflow: auto;
        position: relative;
        outline: none;
        background: radial-gradient(
                circle at 50% 0%,
                color-mix(in srgb, var(--vp-focus) 4%, transparent),
                transparent 70%
            ),
            var(--vp-bg);
    }

    .vp-canvas {
        position: relative;
        min-height: 100%;
        padding: 16px;
        transition: transform 200ms ease;
    }

    .vp-canvas-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        text-align: center;
        opacity: 0.5;
        animation: vp-fade-in 500ms ease;
    }

    .vp-empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
        animation: vp-pulse 3s ease-in-out infinite;
    }

    .vp-empty-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 6px;
    }

    .vp-empty-subtitle {
        font-size: 13px;
        opacity: 0.7;
        max-width: 260px;
        line-height: 1.4;
    }
</style>
