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
import { showGhost, moveGhost, hideGhost, setGhostZoom } from './Ghost';
import { buildDropZoneCache, findClosestDropZone, type DropZone } from './DropZoneCache';
import { autoScroll } from './AutoScroll';
import type { BlockType, BlockCategory } from '../types';

const DRAG_THRESHOLD = 5; // px before drag starts

export class DragController {
    private canvas: HTMLElement;
    private scrollContainer: HTMLElement;
    private paletteEl: HTMLElement | null = null;
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
    private lastZoom = 1;

    // Active drop indicator element
    private activeIndicator: HTMLElement | null = null;

    // Spring displacement tracking
    private displacedElements: Map<HTMLElement, string> = new Map();
    private lastDisplacementKey = '';

    constructor(canvas: HTMLElement, scrollContainer: HTMLElement) {
        this.canvas = canvas;
        this.scrollContainer = scrollContainer;
    }

    /** Attach all event listeners. Must be called after canvas is in the DOM. */
    attach(): void {
        this.abortController = new AbortController();
        const { signal } = this.abortController;

        this.canvas.addEventListener('pointerdown', this.onPointerDown, { signal });

        // Also listen on the palette for palette-initiated drags
        this.paletteEl = document.querySelector<HTMLElement>('.vp-palette');
        if (this.paletteEl) {
            this.paletteEl.addEventListener('pointerdown', this.onPalettePointerDown, { signal });
        }
    }

    /** Remove all event listeners. Call on component destroy. */
    detach(): void {
        this.abortController?.abort();
        this.abortController = null;
        this.cancelDrag();
    }

    /**
     * Get the current scale from the DOM to ensure we match the rendered state.
     * This avoids sync issues between Svelte state and actual DOM layout.
     */
    private getDomScale(): number {
        const style = window.getComputedStyle(this.canvas);
        const transform = style.transform;
        if (!transform || transform === 'none') return 1;

        // matrix(scaleX, skewY, skewX, scaleY, translateX, translateY)
        const match = transform.match(/^matrix\((.+)\)$/);
        if (match) {
            const values = match[1].split(',').map(parseFloat);
            // Assuming uniform scale (a = d in matrix model)
            return values[0] || 1;
        }
        return 1;
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
        if (!header) return;

        const rect = blockEl.getBoundingClientRect();
        const blockId = blockEl.dataset.blockId!;

        this.pointerId = e.pointerId;
        this.originX = e.clientX;
        this.originY = e.clientY;
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        this.sourceElements = [blockEl];
        this.sourceWidth = rect.width;
        this.pointerX = e.clientX;
        this.pointerY = e.clientY;

        dragState.startPending(
            blockId,
            { x: e.clientX, y: e.clientY },
            { dx: this.offsetX, dy: this.offsetY },
            rect,
            false,
            null,
            null,
        );

        // Listen for move/up on window (not canvas — handles edge cases)
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('keydown', this.onKeyDown);
    };

    /** Palette-specific pointerdown: initiates a palette-to-canvas drag */
    private onPalettePointerDown = (e: PointerEvent): void => {
        if (e.button !== 0) return;

        const target = e.target as HTMLElement;
        if (target.closest('input, textarea, select, button')) return;

        const paletteItem = target.closest<HTMLElement>('[data-palette-type]');
        if (!paletteItem) return;

        const rect = paletteItem.getBoundingClientRect();
        const blockId = paletteItem.dataset.blockId || `palette-${paletteItem.dataset.paletteType}`;
        const paletteType = paletteItem.dataset.paletteType || null;
        const paletteCategory = paletteItem.dataset.paletteCategory || null;

        this.pointerId = e.pointerId;
        this.originX = e.clientX;
        this.originY = e.clientY;
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        this.sourceElements = [paletteItem];
        this.sourceWidth = rect.width;
        this.pointerX = e.clientX;
        this.pointerY = e.clientY;

        dragState.startPending(
            blockId,
            { x: e.clientX, y: e.clientY },
            { dx: this.offsetX, dy: this.offsetY },
            rect,
            true,
            paletteType,
            paletteCategory,
        );

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
        const suppressClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };
        window.addEventListener('click', suppressClick, { capture: true, once: true });

        const fromPalette = dragState.data.fromPalette;

        // For canvas blocks, check for multi-selection
        if (!fromPalette) {
            const clickedId = (this.sourceElements[0]?.dataset.blockId) || '';
            const selection = uiState.selectedBlockIds;

            if (selection.includes(clickedId) && selection.length > 1) {
                const allSelectedEls = selection
                    .map(id => document.querySelector(`[data-block-id="${id}"]`) as HTMLElement)
                    .filter(Boolean);

                allSelectedEls.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);

                const roots: HTMLElement[] = [];
                for (const el of allSelectedEls) {
                    const isDescendant = roots.some(root => root.contains(el));
                    if (!isDescendant) roots.push(el);
                }
                this.sourceElements = roots;
            }
        }

        if (this.sourceElements.length > 0) {
            showGhost(this.sourceElements, this.sourceWidth);
            // Hide originals — the ghost is the visual representation now
            if (!fromPalette) {
                this.sourceElements.forEach(el => {
                    el.style.display = 'none';
                });
            }
        }

        // Capture pointer for reliable tracking
        try {
            this.canvas.setPointerCapture(this.pointerId);
        } catch {
            // setPointerCapture can fail if pointer was released before this runs
        }

        // Determine excluded IDs (dragged blocks)
        const sourceId = dragState.data.sourceId || '';
        let excludeIds = [sourceId];
        if (!fromPalette && uiState.selectedBlockIds.includes(sourceId)) {
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

        // Reads DOM state directly to handle zoom transitions correctly
        const domScale = this.getDomScale();

        // Check if scale changed significantly from last frame
        if (Math.abs(this.lastZoom - domScale) > 0.001) {
            this.lastZoom = domScale;

            // Rebuild drop zones with new layout
            const sourceId = dragState.data.sourceId || '';
            let excludeIds = [sourceId];
            if (!dragState.data.fromPalette && uiState.selectedBlockIds.includes(sourceId)) {
                excludeIds = uiState.selectedBlockIds;
            }
            this.dropZones = buildDropZoneCache(this.canvas, excludeIds);

            // Update ghost scale
            setGhostZoom(domScale);
        }

        // 1. Position the ghost
        const gx = this.pointerX - this.offsetX;
        const gy = this.pointerY - this.offsetY;
        moveGhost(gx, gy);

        // 2. Auto-scroll near edges
        autoScroll(this.scrollContainer, this.pointerY);

        // 3. Detect if pointer is over the palette trash zone
        //    (only for existing canvas blocks, not palette-initiated drags)
        if (!dragState.data.fromPalette && this.paletteEl) {
            const paletteRect = this.paletteEl.getBoundingClientRect();
            const isOver = (
                this.pointerX >= paletteRect.left &&
                this.pointerX <= paletteRect.right &&
                this.pointerY >= paletteRect.top &&
                this.pointerY <= paletteRect.bottom
            );
            if (isOver !== dragState.data.overTrash) {
                dragState.setOverTrash(isOver);
            }
        }

        // 4. Hit-test drop zones (skip if over trash)
        const zone = dragState.data.overTrash
            ? null
            : findClosestDropZone(this.dropZones, this.pointerX, this.pointerY);

        // 5. Update drop indicator + spring displacement
        this.updateDropIndicator(zone, domScale);
        this.updateDisplacement(zone, domScale);

        // 6. Update drag state (only if changed)
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
        const { sourceId, dropTarget, fromPalette, paletteType, paletteCategory, overTrash } = dragState.data;

        // Dropped on trash zone — delete the block(s)
        if (overTrash && !fromPalette && sourceId) {
            const selection = uiState.selectedBlockIds;
            if (selection.includes(sourceId) && selection.length > 1) {
                blockStore.removeBlocks(selection);
            } else {
                blockStore.removeBlocks([sourceId]);
            }
            uiState.clearSelection();
            return;
        }

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
                    blockStore.moveBlocks(selection, dropTarget.parentId, dropTarget.index);
                } else {
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
                el.style.display = '';
            });
            this.sourceElements = [];
        }

        // Hide ghost
        hideGhost();

        // Clear drop indicator and displacement
        this.clearDropIndicator();
        this.clearDisplacement();

        // Reset state
        dragState.reset();

        // Remove window listeners
        window.removeEventListener('pointermove', this.onPointerMove);
        window.removeEventListener('pointerup', this.onPointerUp);
        window.removeEventListener('keydown', this.onKeyDown);
    }

    // --- Drop Indicator ---

    private updateDropIndicator(zone: DropZone | null, scale: number): void {
        this.clearDropIndicator();

        if (!zone) return;

        // Find or create the indicator line
        const indicator = document.createElement('div');
        indicator.className = 'vp-drop-indicator';

        const scrollTop = this.scrollContainer.scrollTop;
        const containerRect = this.scrollContainer.getBoundingClientRect();

        // Convert viewport delta to local scaled space
        // zone.rect is in viewport pixels (from getBoundingClientRect)
        // containerRect is in viewport pixels
        // scrollTop is in scroll container pixels (unscaled if container not scaled, which it isn't, only canvas is)

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

    // --- Spring Displacement ---

    /**
     * Apply spring displacement to blocks that need to shift
     * to make room at the current drop position.
     * Uses direct DOM manipulation for max frame rate.
     */
    private updateDisplacement(zone: DropZone | null, scale: number): void {
        const key = zone ? `${zone.parentId}:${zone.index}` : '';

        // No change — skip all DOM work
        if (key === this.lastDisplacementKey) return;
        this.lastDisplacementKey = key;

        // Track which elements should stay displaced (to clear stale ones)
        const nextDisplaced = new Map<HTMLElement, string>();

        if (zone) {
            // Find the parent container element
            let container: HTMLElement | null;
            if (zone.parentId === null) {
                container = this.canvas;
            } else {
                container = this.canvas.querySelector<HTMLElement>(
                    `[data-children-of="${zone.parentId}"]`
                );
            }

            if (container) {
                // Determine excluded IDs (the blocks being dragged)
                const sourceId = dragState.data.sourceId || '';
                let excludeIds = [sourceId];
                if (!dragState.data.fromPalette && uiState.selectedBlockIds.includes(sourceId)) {
                    excludeIds = uiState.selectedBlockIds;
                }

                // Get direct child blocks in this container, excluding dragged ones
                const children = Array.from(
                    container.querySelectorAll<HTMLElement>(':scope > [data-block-id]')
                ).filter(el => !excludeIds.includes(el.dataset.blockId!));

                // Calculate gap height from source rect
                const sourceRect = dragState.data.sourceRect;
                const gapHeight = sourceRect
                    ? (sourceRect.height + 8) / scale  // +8 for margin
                    : 48 / scale;  // fallback

                // Displace children at index >= drop index
                children.forEach((el, i) => {
                    if (i >= zone.index) {
                        const transform = `translateY(${gapHeight}px) translateZ(0)`;
                        nextDisplaced.set(el, transform);

                        // Only write if value changed
                        if (this.displacedElements.get(el) !== transform) {
                            el.style.transform = transform;
                        }
                    }
                });
            }
        }

        // Clear transforms on elements that are no longer displaced
        for (const [el] of this.displacedElements) {
            if (!nextDisplaced.has(el)) {
                el.style.transform = '';
            }
        }

        this.displacedElements = nextDisplaced;
    }

    /** Clear all displacement transforms (called on drag end) */
    private clearDisplacement(): void {
        for (const [el] of this.displacedElements) {
            el.style.transform = '';
        }
        this.displacedElements.clear();
        this.lastDisplacementKey = '';
    }
}
