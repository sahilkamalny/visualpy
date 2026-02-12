/**
 * Pointer-based drag controller.
 * Manages the full drag lifecycle using pointer events + RAF.
 *
 * Architecture note: This is vanilla TypeScript, NOT a Svelte component.
 * The drag hotpath (pointer tracking, ghost positioning, hit-testing)
 * must bypass Svelte's reactivity for maximum frame rate.
 * Svelte stores are only updated at key transition points.
 */
import { dragState } from '../stores/dragState.svelte';
import { blockStore } from '../stores/blockStore.svelte';
import { uiState } from '../stores/uiState.svelte';
import { showGhost, moveGhost, hideGhost } from './Ghost';
import { buildDropZoneCache, findClosestDropZone, type DropZone } from './DropZoneCache';
import { autoScroll } from './AutoScroll';
import type { BlockType, BlockCategory } from '../types';

const DRAG_THRESHOLD = 5; // px before drag starts

export class DragController {
    private canvas: HTMLElement;
    private scrollContainer: HTMLElement;
    private rafId: number | null = null;
    private dropZones: DropZone[] = [];
    private abortController: AbortController | null = null;

    // Pointer state (updated on every move, read by RAF)
    private pointerX = 0;
    private pointerY = 0;
    private pointerId = -1;

    // Pending drag origin
    private originX = 0;
    private originY = 0;
    private offsetX = 0;
    private offsetY = 0;

    private sourceElements: HTMLElement[] = [];
    private sourceWidth = 0;

    // ...

    // --- Pointer Event Handlers ---








    // Active drop indicator element
    private activeIndicator: HTMLElement | null = null;

    constructor(canvas: HTMLElement, scrollContainer: HTMLElement) {
        this.canvas = canvas;
        this.scrollContainer = scrollContainer;
    }

    /** Attach all event listeners. Must be called after canvas is in the DOM. */
    attach(): void {
        this.abortController = new AbortController();
        const { signal } = this.abortController;

        this.canvas.addEventListener('pointerdown', this.onPointerDown, { signal });
    }

    /** Remove all event listeners. Call on component destroy. */
    detach(): void {
        this.abortController?.abort();
        this.abortController = null;
        this.cancelDrag();
    }

    // --- Pointer Event Handlers ---

    private onPointerDown = (e: PointerEvent): void => {
        // Only primary button (left-click)
        if (e.button !== 0) return;

        // Don't drag from inputs
        const target = e.target as HTMLElement;
        if (target.closest('input, textarea, select, button')) return;

        // Find the closest block element
        const blockEl = target.closest<HTMLElement>('[data-block-id]');
        if (!blockEl) return;

        // Find the header (drag handle area)
        const header = target.closest<HTMLElement>('.vp-block-header');
        if (!header && !target.closest<HTMLElement>('.vp-palette-item')) return;

        // DO NOT preventDefault here. We want native click to fire if we don't drag.
        // e.preventDefault(); 

        // Stop propagation to prevent canvas from seeing it?
        // Actually, canvas handles click to clear selection.
        // Block handles click to select.
        // If we let it bubble, Block handles it, stops propagation. Canvas never sees it.
        // Correct.
        // e.stopPropagation();

        // Prevent text selection explicitly via API (or reliable CSS)
        // window.getSelection()?.removeAllRanges();

        const rect = blockEl.getBoundingClientRect();
        const blockId = blockEl.dataset.blockId!;

        this.pointerId = e.pointerId;
        this.originX = e.clientX;
        this.originY = e.clientY;
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        this.sourceElements = [blockEl]; // Initial single source
        this.sourceWidth = rect.width;
        this.pointerX = e.clientX;
        this.pointerY = e.clientY;

        // Check if this is a palette item drag
        const paletteItem = target.closest<HTMLElement>('[data-palette-type]');
        const fromPalette = !!paletteItem;
        const paletteType = paletteItem?.dataset.paletteType || null;
        const paletteCategory = paletteItem?.dataset.paletteCategory || null;

        dragState.startPending(
            blockId,
            { x: e.clientX, y: e.clientY },
            { dx: this.offsetX, dy: this.offsetY },
            rect,
            fromPalette,
            paletteType,
            paletteCategory,
        );

        // Listen for move/up on window (not canvas — handles edge cases)
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('keydown', this.onKeyDown);
    };

    private onPointerMove = (e: PointerEvent): void => {
        this.pointerX = e.clientX;
        this.pointerY = e.clientY;

        if (dragState.data.phase === 'pending') {
            const dx = e.clientX - this.originX;
            const dy = e.clientY - this.originY;
            if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

            // Threshold exceeded — start dragging
            this.promoteToDrag();
        }

        // Schedule RAF if not already scheduled
        if (this.rafId === null && dragState.data.phase === 'dragging') {
            this.rafId = requestAnimationFrame(this.onFrame);
        }
    };

    private onPointerUp = (e: PointerEvent): void => {
        if (dragState.data.phase === 'pending') {
            // Didn't exceed threshold — treat as click.
            // Since we didn't preventDefault in onPointerDown, native 'click' will fire.
            // Block.svelte handles onclick. We do nothing here.
            this.cancelDrag();
            return;
        }

        if (dragState.data.phase === 'dragging') {
            this.commitDrop();
        }

        this.cancelDrag();
    };

    private onKeyDown = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
            e.preventDefault();
            this.cancelDrag();
        }
    };

    // --- Drag Lifecycle ---

    private promoteToDrag(): void {
        dragState.promoteToDragging();

        // Suppress the subsequent click event!
        // Since we dragged, it's not a click.
        // We add a capture-phase listener to stop it.
        const suppressClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };
        window.addEventListener('click', suppressClick, { capture: true, once: true });
        // Cleanup listener if drag is cancelled unusually? 
        // 'once: true' handles it mostly, but if click never comes... it stays.
        // That's risky. Better to attach to canvas?
        // Or set a flag.
        // For distinct UI phases, window capture is reliable enough for now.

        // Check for multi-selection
        const clickedId = (this.sourceElements[0]?.dataset.blockId) || '';
        const selection = uiState.selectedBlockIds;

        if (selection.includes(clickedId) && selection.length > 1) {
            // Find all selected elements
            const allSelectedEls = selection
                .map(id => document.querySelector(`[data-block-id="${id}"]`) as HTMLElement)
                .filter(Boolean);

            // Filter out descendants (only keep roots)
            // Sort by DOM order first
            allSelectedEls.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);

            const roots: HTMLElement[] = [];
            for (const el of allSelectedEls) {
                const isDescendant = roots.some(root => root.contains(el));
                if (!isDescendant) roots.push(el);
            }
            this.sourceElements = roots;
        }

        if (this.sourceElements.length > 0) {
            showGhost(this.sourceElements, this.sourceWidth);
            // Dim originals
            this.sourceElements.forEach(el => {
                el.style.opacity = '0.3';
                el.style.transition = 'opacity 150ms ease';
            });
        }

        // Capture pointer for reliable tracking (works across iframe boundaries)
        try {
            this.canvas.setPointerCapture(this.pointerId);
        } catch {
            // setPointerCapture can fail if pointer was released before this runs
        }

        // Determine excluded IDs (dragged blocks)
        const sourceId = dragState.data.sourceId || '';
        let excludeIds = [sourceId];
        if (uiState.selectedBlockIds.includes(sourceId)) {
            excludeIds = uiState.selectedBlockIds;
        }

        // Build drop zone cache
        this.dropZones = buildDropZoneCache(
            this.canvas,
            excludeIds,
        );

        // Start RAF loop
        this.rafId = requestAnimationFrame(this.onFrame);
    }

    private onFrame = (): void => {
        this.rafId = null;
        if (dragState.data.phase !== 'dragging') return;

        // 1. Position the ghost
        const gx = this.pointerX - this.offsetX;
        const gy = this.pointerY - this.offsetY;
        moveGhost(gx, gy);

        // 2. Auto-scroll near edges
        autoScroll(this.scrollContainer, this.pointerY);

        // 3. Hit-test drop zones
        const zone = findClosestDropZone(this.dropZones, this.pointerX, this.pointerY);

        // 4. Update drop indicator
        this.updateDropIndicator(zone);

        // 5. Update drag state (only if changed)
        const current = dragState.data.dropTarget;
        if (zone) {
            if (!current || current.parentId !== zone.parentId || current.index !== zone.index) {
                dragState.setDropTarget({ parentId: zone.parentId, index: zone.index });
            }
        } else if (current) {
            dragState.setDropTarget(null);
        }

        // Continue RAF loop
        this.rafId = requestAnimationFrame(this.onFrame);
    };

    private commitDrop(): void {
        const { sourceId, dropTarget, fromPalette, paletteType, paletteCategory } = dragState.data;

        if (dropTarget) {
            if (fromPalette && paletteType && paletteCategory) {
                // Create a new block from palette
                const newBlock = blockStore.createBlockFromType(
                    paletteType as BlockType,
                    paletteCategory as BlockCategory,
                );
                blockStore.insertBlockAtIndex(newBlock, dropTarget.parentId, dropTarget.index);
            } else if (sourceId) {
                // Check if we are dragging a selected block along with others
                const selection = uiState.selectedBlockIds;
                if (selection.includes(sourceId) && selection.length > 1) {
                    // Multi-move
                    blockStore.moveBlocks(selection, dropTarget.parentId, dropTarget.index);
                } else {
                    // Single move
                    blockStore.moveBlock(sourceId, dropTarget.parentId, dropTarget.index);
                }
            }
        }
    }

    cancelDrag(): void {
        // Cancel RAF
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // Release pointer capture
        try {
            this.canvas.releasePointerCapture(this.pointerId);
        } catch {
            // May fail if not captured
        }

        // Restore source elements
        if (this.sourceElements.length > 0) {
            this.sourceElements.forEach(el => {
                el.style.opacity = '';
                el.style.transition = '';
            });
            this.sourceElements = [];
        }

        // Hide ghost
        hideGhost();

        // Clear drop indicator
        this.clearDropIndicator();

        // Reset state
        dragState.reset();

        // Remove window listeners
        window.removeEventListener('pointermove', this.onPointerMove);
        window.removeEventListener('pointerup', this.onPointerUp);
        window.removeEventListener('keydown', this.onKeyDown);
    }

    // --- Drop Indicator ---

    private updateDropIndicator(zone: DropZone | null): void {
        this.clearDropIndicator();

        if (!zone) return;

        // Find or create the indicator line
        const indicator = document.createElement('div');
        indicator.className = 'vp-drop-indicator';

        // Calculate position in scaled coordinates
        const scale = uiState.zoomLevel / 100;
        const scrollTop = this.scrollContainer.scrollTop;
        const containerRect = this.scrollContainer.getBoundingClientRect();

        // Convert viewport delta to local scaled space
        // y_local * scale = y_viewport - container_top + scrollTop (approx)
        // Note: scrollTop on the container is in unscaled pixels relative to the container's viewport,
        // but the content size IS scaled.
        // Actually, containerRect.top is viewport. zone.rect.top is viewport.
        // The difference is viewport pixels.
        // To map to local canvas pixels: delta_viewport / scale.
        // Then add the scroll offset (which is in container-space, effectively viewport-space relative to content start).
        // Wait, if content is scaled, browser scrollbars adjust.
        // scrollTop 100 means we scrolled 100 "container pixels".
        // If scale is 0.5, 100 container pixels = 200 local canvas pixels?
        // No, usually scrollTop is in CSS pixels of the scroller.
        // If content is scaled transform, layout size changes.
        // Let's rely on standard projection:
        const yViewportRel = zone.rect.top + zone.rect.height / 2 - containerRect.top;
        const yLocal = (yViewportRel + scrollTop) / scale;

        indicator.style.cssText = `
      position: absolute;
      left: ${8 / scale}px;
      right: ${8 / scale}px;
      top: ${yLocal}px;
      height: ${4 / scale}px;
      background: var(--vp-focus, #3B82F6);
      border-radius: ${2 / scale}px;
      z-index: 100;
      pointer-events: none;
      box-shadow: 0 0 ${8 / scale}px rgba(59, 130, 246, 0.5);
      animation: vp-pulse 1.2s ease-in-out infinite;
    `;

        this.canvas.appendChild(indicator);
        this.activeIndicator = indicator;
    }

    private clearDropIndicator(): void {
        if (this.activeIndicator) {
            this.activeIndicator.remove();
            this.activeIndicator = null;
        }
    }
}
