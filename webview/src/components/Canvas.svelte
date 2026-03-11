<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Block from "./Block.svelte";
    import { blockStore } from "../lib/stores/blockStore.svelte";
    import { uiState } from "../lib/stores/uiState.svelte";
    import { dragState } from "../lib/stores/dragState.svelte";
    import { DragController } from "../lib/drag/DragController";

    // svelte-ignore non_reactive_update
    let canvasEl: HTMLElement;
    // svelte-ignore non_reactive_update
    let scrollContainer: HTMLElement;
    // svelte-ignore non_reactive_update
    let glowEl: HTMLElement;
    let dragController: DragController | null = null;
    type LassoRect = { x: number; y: number; w: number; h: number };

    // --- Dot glow effect ---
    let glowVisible = $state(false);
    let glowRafId = 0;

    function handleGlowMove(e: MouseEvent) {
        if (!glowEl) return;
        if (!glowVisible) glowVisible = true;
        // Throttle to one update per animation frame
        if (glowRafId) return;
        glowRafId = requestAnimationFrame(() => {
            glowRafId = 0;
            // Position relative to the scroll container's content origin
            // (viewport-relative coords + scroll offset)
            const rect = scrollContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + scrollContainer.scrollLeft;
            const y = e.clientY - rect.top + scrollContainer.scrollTop;
            glowEl.style.setProperty("--mx", `${x}px`);
            glowEl.style.setProperty("--my", `${y}px`);
        });
    }

    function handleGlowLeave() {
        glowVisible = false;
    }

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
        detachLassoListeners();
        if (glowRafId) {
            cancelAnimationFrame(glowRafId);
            glowRafId = 0;
        }
        if (hitTestRafId) {
            cancelAnimationFrame(hitTestRafId);
            hitTestRafId = 0;
        }
        lassoRect = null;
    });

    function handleCanvasClick(e: MouseEvent) {
        // One-shot swallow: consume the click emitted immediately after a lasso drag.
        if (suppressNextCanvasClick) {
            suppressNextCanvasClick = false;
            e.stopPropagation();
            return;
        }
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

    // --- Lasso (rectangular) selection ---
    let lassoActive = false;
    let lassoStartX = 0;
    let lassoStartY = 0;
    let lassoDragged = false; // true once mouse moves beyond threshold
    let suppressNextCanvasClick = false;
    let lassoRect = $state<LassoRect | null>(null);
    let hitTestRafId = 0; // rAF throttle for hit-testing
    const LASSO_THRESHOLD = 3; // px — ignore movement smaller than this

    function detachLassoListeners() {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
    }

    function handleMouseDown(e: MouseEvent) {
        // Only start lasso on left-click on empty canvas area (not on blocks)
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target !== canvasEl && target !== scrollContainer) return;

        // Prevent native text selection during lasso drag
        e.preventDefault();

        // Begin lasso
        lassoActive = true;
        lassoDragged = false;
        suppressNextCanvasClick = false;
        lassoRect = null;
        const rect = scrollContainer.getBoundingClientRect();
        lassoStartX = e.clientX - rect.left + scrollContainer.scrollLeft;
        lassoStartY = e.clientY - rect.top + scrollContainer.scrollTop;

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    }

    function handleMouseMove(e: MouseEvent) {
        if (!lassoActive) return;

        const rect = scrollContainer.getBoundingClientRect();
        const curX = e.clientX - rect.left + scrollContainer.scrollLeft;
        const curY = e.clientY - rect.top + scrollContainer.scrollTop;

        // Check if movement exceeds threshold (only once)
        if (!lassoDragged) {
            const dx = curX - lassoStartX;
            const dy = curY - lassoStartY;
            if (dx * dx + dy * dy < LASSO_THRESHOLD * LASSO_THRESHOLD) return;
            lassoDragged = true;
            uiState.clearSelection();
        }

        const x = Math.min(lassoStartX, curX);
        const y = Math.min(lassoStartY, curY);
        const w = Math.abs(curX - lassoStartX);
        const h = Math.abs(curY - lassoStartY);

        lassoRect = { x, y, w, h };

        // Throttle hit-testing to once per animation frame
        if (!hitTestRafId) {
            hitTestRafId = requestAnimationFrame(() => {
                hitTestRafId = 0;
                performHitTest();
            });
        }
    }

    function performHitTest() {
        const lr = lassoRect;
        if (!lr) return;

        const rect = scrollContainer.getBoundingClientRect();
        const lassoClientLeft = lr.x - scrollContainer.scrollLeft + rect.left;
        const lassoClientTop = lr.y - scrollContainer.scrollTop + rect.top;
        const lassoClientRight = lassoClientLeft + lr.w;
        const lassoClientBottom = lassoClientTop + lr.h;

        const blockEls = canvasEl.querySelectorAll(".vp-block[data-block-id]");
        const hitIds: string[] = [];

        blockEls.forEach((el) => {
            const br = el.getBoundingClientRect();
            if (
                br.left < lassoClientRight &&
                br.right > lassoClientLeft &&
                br.top < lassoClientBottom &&
                br.bottom > lassoClientTop
            ) {
                const id = el.getAttribute("data-block-id");
                if (id) hitIds.push(id);
            }
        });

        uiState.selectedBlockIds = hitIds;
    }

    function handleMouseUp() {
        if (!lassoActive) return;
        if (hitTestRafId) {
            cancelAnimationFrame(hitTestRafId);
            hitTestRafId = 0;
            performHitTest();
        }
        if (lassoDragged) {
            // Suppress only the synthetic click immediately following mouseup.
            suppressNextCanvasClick = true;
            setTimeout(() => {
                suppressNextCanvasClick = false;
            }, 0);
        }
        lassoActive = false;
        lassoRect = null;
        detachLassoListeners();
    }

    const zoomTransform = $derived(`scale(${uiState.zoomLevel / 100})`);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="vp-canvas-container"
    bind:this={scrollContainer}
    onclick={handleCanvasClick}
    oncontextmenu={handleContextMenu}
    onmousedown={handleMouseDown}
    onmousemove={handleGlowMove}
    onmouseleave={handleGlowLeave}
    role="tree"
    tabindex="0"
    aria-label="Block canvas"
>
    <!-- Dot glow overlay (brighter dots masked to mouse vicinity) -->
    <div
        class="vp-dot-glow"
        class:visible={glowVisible}
        bind:this={glowEl}
    ></div>
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

    <!-- Lasso selection rectangle -->
    {#if lassoRect}
        <div
            class="vp-lasso-rect"
            style="
                left: {lassoRect.x - scrollContainer.scrollLeft}px;
                top: {lassoRect.y - scrollContainer.scrollTop}px;
                width: {lassoRect.w}px;
                height: {lassoRect.h}px;
            "
        ></div>
    {/if}
</div>

<style>
    .vp-canvas-container {
        flex: 1;
        overflow: auto;
        position: relative;
        /* Dot grid pattern */
        background-color: var(--vp-bg);
        background-image: radial-gradient(
            var(--vp-border) 1px,
            transparent 1px
        );
        background-size: 20px 20px;
        background-position: 0 0;
    }

    /* Dot glow overlay — same dot pattern but brighter, masked to mouse area */
    .vp-dot-glow {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        /* Match the container's dot grid, but with a brighter dot color */
        background-image: radial-gradient(
            rgba(255, 255, 255, 1) 1px,
            transparent 1px
        );
        background-size: 20px 20px;
        background-position: 0 0;
        /* Radial mask centered on mouse — 60px = 3 dots × 20px spacing */
        -webkit-mask-image: radial-gradient(
            circle 40px at var(--mx, -100px) var(--my, -100px),
            black,
            transparent
        );
        mask-image: radial-gradient(
            circle 40px at var(--mx, -100px) var(--my, -100px),
            black,
            transparent
        );
        opacity: 0;
        transition: opacity 200ms ease;
    }

    .vp-dot-glow.visible {
        opacity: 1;
    }

    .vp-canvas {
        position: relative;
        min-height: 100%;
        padding: 40px;
        transition: transform 150ms cubic-bezier(0.2, 0, 0, 1);
    }

    .vp-canvas-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 80vh; /* Centered visually */
        text-align: center;
        opacity: 0.6;
        animation: vp-fade-in 400ms ease;
        user-select: none;
        pointer-events: none;
    }

    .vp-empty-icon {
        font-size: 64px;
        margin-bottom: 24px;
        filter: grayscale(1);
        opacity: 0.5;
    }

    .vp-empty-title {
        font-size: 20px;
        font-weight: 500;
        margin-bottom: 8px;
        color: var(--vp-fg);
    }

    .vp-empty-subtitle {
        font-size: 14px;
        opacity: 0.7;
        max-width: 300px;
        line-height: 1.5;
    }

    /* Lasso selection rectangle */
    .vp-lasso-rect {
        position: absolute;
        border: 1.5px solid var(--vp-focus, #3b82f6);
        background: color-mix(
            in srgb,
            var(--vp-focus, #3b82f6) 12%,
            transparent
        );
        border-radius: 2px;
        pointer-events: none;
        z-index: 1000;
    }
</style>
