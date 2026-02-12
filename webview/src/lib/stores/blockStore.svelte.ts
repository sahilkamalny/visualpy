/**
 * Block store — the single source of truth for the block tree.
 * Uses Svelte 5 runes ($state) for reactivity.
 * Drag does NOT mutate this store — only committed actions do.
 */
import type { Block, BlockType, BlockCategory } from '../types';
import { deepClone, generateId } from '../utils';
import { BLOCK_TEMPLATES } from '../types';

// --- Undo/Redo History ---
interface HistoryEntry {
    blocks: Block[];
}

const MAX_HISTORY = 50;

class BlockStoreImpl {
    blocks = $state<Block[]>([]);
    private _past = $state<string[]>([]);
    private _future = $state<string[]>([]);
    private _pendingSnapshot: string | null = null;

    canUndo = $derived(this._past.length > 0);
    canRedo = $derived(this._future.length > 0);

    /** Push current state to undo stack before a mutation */
    private pushHistory(): void {
        this._past.push(JSON.stringify(this.blocks));
        if (this._past.length > MAX_HISTORY) this._past.shift();
        this._future = [];
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

    moveBlocks(sourceIds: string[], targetParentId: string | null, targetIndex: number): void {
        if (sourceIds.length === 0) return;
        this.pushHistory();

        // 1. Find and sort blocks by their current visual order (tree traversal)
        // This ensures they stay in relative order when moved
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
        let adjustedTargetIndex = targetIndex;

        for (const id of orderedIds) {
            // Find parent and index before removing
            // We need this to adjust targetIndex if removed from same parent
            const info = this.findBlockInfo(id);
            if (!info) continue;

            const block = this.removeFromTree(id);
            if (block) {
                blocksToInsert.push(block);

                // If removed from the target parent, and was "before" the target index, decrement target index
                if (info.parentId === targetParentId && info.index < adjustedTargetIndex) {
                    adjustedTargetIndex--;
                }
            }
        }

        // 3. Insert all at the adjusted index
        // We insert them in reverse so they end up in the correct order if inserting one by one
        // OR better: batch insert.
        // insertAtIndex helper inserts one.
        // If we insert "orderedIds[0]" at T, then "orderedIds[1]" at T+1...

        let currentIdx = adjustedTargetIndex;
        for (const block of blocksToInsert) {
            this.insertAtIndex(block, targetParentId, currentIdx);
            currentIdx++;
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

    duplicateBlock(id: string): void {
        const original = this.findBlock(id);
        if (!original) return;
        this.pushHistory();
        // Use JSON clone to avoid proxy issues with structuredClone
        const clone = JSON.parse(JSON.stringify(original));
        reIdBlock(clone);
        if (!this.insertAfter(clone, id)) {
            this.blocks.push(clone);
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
        for (let i = 0; i < newList.length; i++) {
            const newBlock = newList[i];
            // Try to find a matching block in the old list at the same index
            // (Heuristic: massive reshuffles might lose identity, but that's acceptable for now)
            const oldBlock = oldList[i];

            if (oldBlock && oldBlock.type === newBlock.type) {
                // Match found! Preserve ID.
                newBlock.id = oldBlock.id;

                // Preserve UI state (collapsed)
                if (oldBlock.metadata?.collapsed !== undefined) {
                    if (!newBlock.metadata) newBlock.metadata = {} as any;
                    newBlock.metadata.collapsed = oldBlock.metadata.collapsed;
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
