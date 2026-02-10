/**
 * Ephemeral drag state — never persisted, never sent to extension host.
 * Updated on every pointer move via RAF, read by the renderer.
 */

export type DragPhase = 'idle' | 'pending' | 'dragging' | 'snapping';

export interface DropTarget {
    parentId: string | null;  // null = root level
    index: number;
}

export interface DragStateData {
    phase: DragPhase;
    sourceId: string | null;
    sourceOrigin: { x: number; y: number } | null;
    ghostOffset: { dx: number; dy: number } | null;
    currentPointer: { x: number; y: number } | null;
    dropTarget: DropTarget | null;
    sourceRect: DOMRect | null;
    /** Whether the drag originated from the palette (vs an existing block) */
    fromPalette: boolean;
    /** For palette drags, the block type/category */
    paletteType: string | null;
    paletteCategory: string | null;
}

const INITIAL_STATE: DragStateData = {
    phase: 'idle',
    sourceId: null,
    sourceOrigin: null,
    ghostOffset: null,
    currentPointer: null,
    dropTarget: null,
    sourceRect: null,
    fromPalette: false,
    paletteType: null,
    paletteCategory: null,
};

class DragStateStore {
    data = $state<DragStateData>({ ...INITIAL_STATE });

    get isDragging(): boolean {
        return this.data.phase === 'dragging';
    }

    get isIdle(): boolean {
        return this.data.phase === 'idle';
    }

    startPending(
        sourceId: string,
        origin: { x: number; y: number },
        offset: { dx: number; dy: number },
        rect: DOMRect,
        fromPalette: boolean = false,
        paletteType: string | null = null,
        paletteCategory: string | null = null,
    ): void {
        this.data = {
            phase: 'pending',
            sourceId,
            sourceOrigin: origin,
            ghostOffset: offset,
            currentPointer: { ...origin },
            dropTarget: null,
            sourceRect: rect,
            fromPalette,
            paletteType,
            paletteCategory,
        };
    }

    promoteToDragging(): void {
        this.data.phase = 'dragging';
    }

    updatePointer(x: number, y: number): void {
        this.data.currentPointer = { x, y };
    }

    setDropTarget(target: DropTarget | null): void {
        this.data.dropTarget = target;
    }

    startSnapping(): void {
        this.data.phase = 'snapping';
    }

    reset(): void {
        this.data = { ...INITIAL_STATE };
    }
}

export const dragState = new DragStateStore();
