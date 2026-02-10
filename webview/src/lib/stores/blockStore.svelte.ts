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

    canUndo = $derived(this._past.length > 0);
    canRedo = $derived(this._future.length > 0);

    /** Push current state to undo stack before a mutation */
    private pushHistory(): void {
        this._past.push(JSON.stringify(this.blocks));
        if (this._past.length > MAX_HISTORY) this._past.shift();
        this._future = [];
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
            this.insertAtIndex(block, targetParentId, targetIndex);
        }
        // Trigger reactivity
        this.blocks = [...this.blocks];
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

    duplicateBlock(id: string): void {
        const original = this.findBlock(id);
        if (!original) return;
        this.pushHistory();
        const clone = deepClone(original);
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
}

/** Recursively assign new IDs to a block and all its descendants */
function reIdBlock(block: Block): void {
    block.id = generateId();
    if (block.children) block.children.forEach(reIdBlock);
    if (block.attachments) block.attachments.forEach(reIdBlock);
}

/** Global block store singleton */
export const blockStore = new BlockStoreImpl();
