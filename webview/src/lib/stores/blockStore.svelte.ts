/**
 * Block store — the single source of truth for the block tree.
 * Uses Svelte 5 runes ($state) for reactivity.
 * Drag does NOT mutate this store — only committed actions do.
 */
import type { Block, BlockType, BlockCategory } from '../types';
import { deepClone, generateId } from '../utils';
import { BLOCK_TEMPLATES } from '../types';
import { buildScopedSymbolSuggestionMap, collectSymbolSuggestions } from '../symbols';

// --- Undo/Redo History ---
interface HistoryEntry {
    blocks: Block[];
}

const MAX_HISTORY = 50;

class BlockStoreImpl {
    blocks = $state<Block[]>([]);
    symbolSuggestions = $derived(collectSymbolSuggestions(this.blocks));
    scopedSymbolSuggestions = $derived(buildScopedSymbolSuggestionMap(this.blocks));

    /** Tracks the field currently being edited so reconcileBlocks skips it */
    activeEditField: { blockId: string; fieldId: string } | null = null;
    private _past = $state<string[]>([]);
    private _future = $state<string[]>([]);
    private _pendingSnapshot: string | null = null;

    canUndo = $derived(this._past.length > 0);
    canRedo = $derived(this._future.length > 0);

    private _batchDepth = 0;

    getScopedSymbolSuggestions(blockId: string): string[] {
        const scoped = this.scopedSymbolSuggestions[blockId];
        if (scoped && scoped.length > 0) {
            return scoped;
        }
        return this.symbolSuggestions;
    }

    /** Push current state to undo stack before a mutation */
    private pushHistory(): void {
        if (this._batchDepth > 0) return; // Batch transaction in progress
        this._past.push(JSON.stringify(this.blocks));
        if (this._past.length > MAX_HISTORY) this._past.shift();
        this._future = [];
    }

    startBatch(): void {
        if (this._batchDepth === 0) {
            this.pushHistory(); // Save state at start of batch
        }
        this._batchDepth++;
    }

    endBatch(): void {
        if (this._batchDepth > 0) {
            this._batchDepth--;
        }
    }

    // ... (rest of class) ...

    moveBlocks(sourceIds: string[], targetParentId: string | null, targetIndex: number): void {
        if (sourceIds.length === 0) return;
        this.pushHistory();

        // 1. Find and sort blocks by their current visual order
        const orderedIds: string[] = [];
        const visit = (list: Block[]) => {
            for (const b of list) {
                if (sourceIds.includes(b.id)) orderedIds.push(b.id);
                if (b.children) visit(b.children);
                if (b.attachments) visit(b.attachments);
            }
        };
        visit(this.blocks);

        // 2. Remove blocks and collect them
        const blocksToInsert: Block[] = [];

        for (const id of orderedIds) {
            const block = this.removeFromTree(id);
            if (block) {
                blocksToInsert.push(block);
            }
        }

        // 3. Insert all at the target index
        // Since DropZoneCache now excludes all moving blocks, the targetIndex
        // is already relative to the list *without* these blocks.
        // No manual adjustment is needed.
        let currentIdx = targetIndex;
        for (const block of blocksToInsert) {
            this.insertAtIndex(block, targetParentId, currentIdx);
            currentIdx++;
        }

        this.blocks = [...this.blocks];
    }

    // ... 

    duplicateBlocks(ids: string[]): void {
        this.startBatch();
        try {
            for (const id of ids) {
                // duplicateBlock logic inline to avoid double history push if called directly?
                // But duplicateBlock calls pushHistory. Batch suppresses it.
                this.duplicateBlock(id);
            }
        } finally {
            this.endBatch();
        }
    }

    insertBlocks(blocks: Block[], targetId: string | null): void {
        this.startBatch();
        try {
            // Find target index/parent once?
            // Or just use insertBlock for each.
            // If inserting multiple, we probably want them sequential.
            // insertBlock(block, targetId) inserts AFTER targetId.
            // If we insert A after T.
            // Then B after T.
            // Result: T, B, A. (Reverse order).
            // We should insert A after T. Then B after A.
            let currentTargetId = targetId;
            for (const block of blocks) {
                this.insertBlock(block, currentTargetId);
                currentTargetId = block.id; // Next one after this one
            }
        } finally {
            this.endBatch();
        }
    }

    duplicateBlock(id: string): void {
        const original = this.findBlock(id);
        if (!original) return;
        this.pushHistory(); // Suppressed if in batch
        // Use JSON clone to avoid proxy issues with structuredClone
        const clone = JSON.parse(JSON.stringify(original));
        reIdBlock(clone);
        if (!this.insertAfter(clone, id)) {
            this.blocks.push(clone);
        }
        this.blocks = [...this.blocks];
    }
    /**
     * Save a snapshot of the current state for undo.
     * Called when a text field gains focus (before any typing).
     */
    saveSnapshot(): void {
        this._pendingSnapshot = JSON.stringify(this.blocks);
    }

    /**
     * Commit the pending snapshot to the undo stack.
     * Called indirectly: updateField checks for a pending snapshot.
     */
    private commitSnapshot(): void {
        if (this._pendingSnapshot !== null) {
            this._past.push(this._pendingSnapshot);
            if (this._past.length > MAX_HISTORY) this._past.shift();
            this._future = [];
            this._pendingSnapshot = null;
        }
    }

    /**
     * Discard the pending snapshot (field value didn't change).
     */
    discardSnapshot(): void {
        this._pendingSnapshot = null;
    }

    /** Replace blocks from external source (e.g., INIT message). Clears history. */
    setBlocks(newBlocks: Block[]): void {
        this.blocks = newBlocks;
        this._past = [];
        this._future = [];
    }

    /** Update blocks from code sync (preserves history) */
    updateBlocks(newBlocks: Block[]): void {
        this.blocks = newBlocks;
    }

    undo(): boolean {
        if (this._past.length === 0) return false;
        this._future.push(JSON.stringify(this.blocks));
        const prev = this._past.pop()!;
        this.blocks = JSON.parse(prev);
        return true;
    }

    redo(): boolean {
        if (this._future.length === 0) return false;
        this._past.push(JSON.stringify(this.blocks));
        const next = this._future.pop()!;
        this.blocks = JSON.parse(next);
        return true;
    }

    // --- Tree traversal helpers ---

    findBlock(id: string, list: Block[] = this.blocks): Block | null {
        for (const block of list) {
            if (block.id === id) return block;
            if (block.children) {
                const found = this.findBlock(id, block.children);
                if (found) return found;
            }
            if (block.attachments) {
                const found = this.findBlock(id, block.attachments);
                if (found) return found;
            }
        }
        return null;
    }

    /** Remove a block from its current position. Returns the removed block or null. */
    private removeFromTree(id: string, list: Block[] = this.blocks): Block | null {
        const idx = list.findIndex(b => b.id === id);
        if (idx !== -1) {
            return list.splice(idx, 1)[0];
        }
        for (const block of list) {
            if (block.children) {
                const found = this.removeFromTree(id, block.children);
                if (found) return found;
            }
            if (block.attachments) {
                const found = this.removeFromTree(id, block.attachments);
                if (found) return found;
            }
        }
        return null;
    }

    /** Insert a block after a target block (or at end of list if no target) */
    private insertAfter(block: Block, targetId: string | null, list: Block[] = this.blocks): boolean {
        if (!targetId) {
            list.push(block);
            return true;
        }
        const idx = list.findIndex(b => b.id === targetId);
        if (idx !== -1) {
            list.splice(idx + 1, 0, block);
            return true;
        }
        for (const item of list) {
            if (item.children && this.insertAfter(block, targetId, item.children)) return true;
            if (item.attachments && this.insertAfter(block, targetId, item.attachments)) return true;
        }
        return false;
    }

    /** Insert a block at a specific index in a parent's children or root */
    private insertAtIndex(block: Block, parentId: string | null, index: number): boolean {
        if (!parentId) {
            this.blocks.splice(index, 0, block);
            return true;
        }
        const parent = this.findBlock(parentId);
        if (parent && parent.children) {
            parent.children.splice(Math.min(index, parent.children.length), 0, block);
            return true;
        }
        return false;
    }

    // --- Public mutation methods ---

    moveBlock(sourceId: string, targetParentId: string | null, targetIndex: number): void {
        this.pushHistory();
        const block = this.removeFromTree(sourceId);
        if (block) {
            // Adjust index if we removed from the same parent before the target
            // (Actually removeFromTree doesn't tell us where it came from easily without more lookup)
            // But for single block move, the caller (DragController) usually provides the visual target index.
            // If we assume DragController targets are based on the "ghost" position,
            // we have to be careful.
            // Simplified: insertAtIndex handles basic insertion.
            this.insertAtIndex(block, targetParentId, targetIndex);
        }
        this.blocks = [...this.blocks];
    }



    private findBlockInfo(id: string, list: Block[] = this.blocks, parentId: string | null = null): { parentId: string | null, index: number } | null {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === id) return { parentId, index: i };
            if (list[i].children) {
                const found = this.findBlockInfo(id, list[i].children, list[i].id);
                if (found) return found;
            }
            if (list[i].attachments) {
                const found = this.findBlockInfo(id, list[i].attachments, list[i].id); // Attachments share parent? Or are children?
                // Attachments (elif/else) usually tracked as siblings in some views, but here they are properties.
                // If we treat them as children for movement...
                if (found) return found;
            }
        }
        return null;
    }

    insertBlock(block: Block, afterTargetId: string | null): void {
        this.pushHistory();
        if (!this.insertAfter(block, afterTargetId)) {
            this.blocks.push(block);
        }
        this.blocks = [...this.blocks];
    }

    insertBlockAtIndex(block: Block, parentId: string | null, index: number): void {
        this.pushHistory();
        this.insertAtIndex(block, parentId, index);
        this.blocks = [...this.blocks];
    }

    removeBlock(id: string): void {
        this.pushHistory();
        this.removeFromTree(id);
        this.blocks = [...this.blocks];
    }

    removeBlocks(ids: string[]): void {
        this.pushHistory();
        for (const id of ids) {
            this.removeFromTree(id);
        }
        this.blocks = [...this.blocks];
    }



    updateField(blockId: string, fieldId: string, value: string): void {
        const block = this.findBlock(blockId);
        if (!block) return;
        const field = block.content.editable?.find(f => f.id === fieldId);
        if (field) {
            // Commit the focus-time snapshot (if any) on first keystroke.
            // This gives us exactly one undo entry per focus session.
            this.commitSnapshot();
            field.value = value;
            // Trigger reactivity 
            this.blocks = [...this.blocks];
        }
    }

    /**
     * Update a field value in-place WITHOUT triggering a reactive re-render.
     * Used during active typing to avoid clobbering the DOM input.
     */
    updateFieldQuiet(blockId: string, fieldId: string, value: string): void {
        const block = this.findBlock(blockId);
        if (!block) return;
        const field = block.content.editable?.find(f => f.id === fieldId);
        if (field) {
            this.commitSnapshot();
            field.value = value;
            // Do NOT reassign this.blocks — no reactive re-render
        }
    }

    /**
     * Trigger a deferred reactive update after quiet field mutations.
     * Called from a debounce timer or on blur.
     */
    flushFieldUpdate(): void {
        this.blocks = [...this.blocks];
    }

    toggleCollapse(id: string): void {
        const block = this.findBlock(id);
        if (block) {
            block.metadata.collapsed = !block.metadata.collapsed;
            this.blocks = [...this.blocks];
        }
    }

    createBlockFromType(type: BlockType, category: BlockCategory): Block {
        const template = BLOCK_TEMPLATES[type];
        return {
            id: generateId(),
            type,
            category,
            content: {
                raw: type,
                editable: template?.editable ? deepClone(template.editable) : [],
            },
            children: template?.hasChildren ? [] : undefined,
            attachments: template?.hasChildren ? [] : undefined,
            metadata: {
                sourceRange: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 0 },
                comments: [],
                collapsed: false,
            },
        };
    }

    /**
     * Smart merge: updates blocks from external source but preserves IDs of matching blocks.
     * This prevents UI thrashing (scroll loss, selection loss) when the extension re-parses code.
     */
    reconcileBlocks(newBlocks: Block[]): void {
        const oldBlocks = this.blocks;
        this.reconcileList(newBlocks, oldBlocks);
        this.blocks = newBlocks;
        // Do NOT clear history.
        // We want to preserve the undo stack even if the backend reformats/syncs code.
        // this._past = []; 
        // this._future = [];
    }

    private reconcileList(newList: Block[], oldList: Block[]): void {
        const usedOldIndexes = new Set<number>();

        for (let i = 0; i < newList.length; i++) {
            const newBlock = newList[i];
            const matchIdx = this.findBestReconcileMatch(newBlock, i, oldList, usedOldIndexes);
            if (matchIdx === -1) continue;

            usedOldIndexes.add(matchIdx);
            const oldBlock = oldList[matchIdx];

            // Match found! Preserve ID.
            newBlock.id = oldBlock.id;

            // Preserve UI state (collapsed)
            if (oldBlock.metadata?.collapsed !== undefined) {
                if (!newBlock.metadata) newBlock.metadata = {} as any;
                newBlock.metadata.collapsed = oldBlock.metadata.collapsed;
            }

            // Preserve the value of any field currently being edited.
            // This prevents the sync roundtrip from clobbering in-flight keystrokes.
            if (this.activeEditField && oldBlock.id === this.activeEditField.blockId) {
                const editingFieldId = this.activeEditField.fieldId;
                const oldField = oldBlock.content.editable?.find(f => f.id === editingFieldId);
                const newField = newBlock.content.editable?.find(f => f.id === editingFieldId);
                if (oldField && newField) {
                    newField.value = oldField.value;
                }
            }

            // Recurse children
            if (newBlock.children && oldBlock.children) {
                this.reconcileList(newBlock.children, oldBlock.children);
            }

            // Recurse attachments (elif, else, etc.)
            if (newBlock.attachments && oldBlock.attachments) {
                this.reconcileList(newBlock.attachments, oldBlock.attachments);
            }
        }
    }

    private findBestReconcileMatch(
        newBlock: Block,
        newIndex: number,
        oldList: Block[],
        usedOldIndexes: Set<number>,
    ): number {
        // Fast path: keep old behavior when index/type already line up.
        if (
            newIndex < oldList.length &&
            !usedOldIndexes.has(newIndex) &&
            oldList[newIndex].type === newBlock.type
        ) {
            return newIndex;
        }

        // During active editing, prioritize preserving that exact block identity
        // so incoming parser updates don't steal focus/value.
        if (this.activeEditField) {
            for (let idx = 0; idx < oldList.length; idx++) {
                if (usedOldIndexes.has(idx)) continue;
                const oldBlock = oldList[idx];
                if (oldBlock.id !== this.activeEditField.blockId) continue;
                if (oldBlock.type !== newBlock.type) continue;
                const fieldExists = newBlock.content.editable?.some(
                    field => field.id === this.activeEditField!.fieldId,
                );
                if (fieldExists) {
                    return idx;
                }
            }
        }

        // Prefer exact source-range matches for stable identity across insertions.
        const byRange = this.findClosestUnusedOldIndex(
            newBlock,
            oldList,
            usedOldIndexes,
            oldBlock => this.sameSourceRange(oldBlock, newBlock),
            newIndex,
        );
        if (byRange !== -1) {
            return byRange;
        }

        // Fallback: match by type + raw string to preserve IDs for unchanged lines.
        return this.findClosestUnusedOldIndex(
            newBlock,
            oldList,
            usedOldIndexes,
            oldBlock => oldBlock.content.raw === newBlock.content.raw,
            newIndex,
        );
    }

    private findClosestUnusedOldIndex(
        newBlock: Block,
        oldList: Block[],
        usedOldIndexes: Set<number>,
        predicate: (oldBlock: Block) => boolean,
        pivotIndex: number,
    ): number {
        let bestIdx = -1;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (let idx = 0; idx < oldList.length; idx++) {
            if (usedOldIndexes.has(idx)) continue;
            const oldBlock = oldList[idx];
            if (oldBlock.type !== newBlock.type) continue;
            if (!predicate(oldBlock)) continue;

            const distance = Math.abs(idx - pivotIndex);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIdx = idx;
            }
        }

        return bestIdx;
    }

    private sameSourceRange(left: Block, right: Block): boolean {
        const l = left.metadata?.sourceRange;
        const r = right.metadata?.sourceRange;
        if (!l || !r) return false;
        return (
            l.startLine === r.startLine &&
            l.startColumn === r.startColumn &&
            l.endLine === r.endLine &&
            l.endColumn === r.endColumn
        );
    }
}

/** Recursively assign new IDs to a block and all its descendants */
function reIdBlock(block: Block): void {
    block.id = generateId();
    if (block.children) block.children.forEach(reIdBlock);
    if (block.attachments) block.attachments.forEach(reIdBlock);
}

/** Global block store singleton */
export const blockStore = new BlockStoreImpl();
