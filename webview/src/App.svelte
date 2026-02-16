<script lang="ts">
  import Toolbar from "./components/Toolbar.svelte";
  import Palette from "./components/Palette.svelte";
  import Canvas from "./components/Canvas.svelte";
  import ContextMenu from "./components/ContextMenu.svelte";
  import Toast from "./components/Toast.svelte";
  import { blockStore } from "./lib/stores/blockStore.svelte";
  import { uiState } from "./lib/stores/uiState.svelte";
  import { dragState } from "./lib/stores/dragState.svelte";
  import { send, onMessage, saveState } from "./lib/bridge";
  import { debounce, generateId } from "./lib/utils";
  import type { Block } from "./lib/types";

  // Guard: don't sync blocks back to the host until we've received
  // the first INIT payload.
  let initialized = false;

  // Guard: suppress the $effect from echoing blocks back when we
  // are processing an incoming message from the extension host.
  let receivingFromHost = false;

  // --- Extension host message handler ---

  // Find the deepest block whose sourceRange contains the given 1-based line.
  function findBlockAtLine(blocks: Block[], line: number): Block | null {
    for (const block of blocks) {
      const sr = block.metadata?.sourceRange;
      if (sr && line >= sr.startLine && line <= sr.endLine) {
        if (block.children) {
          const child = findBlockAtLine(block.children, line);
          if (child) return child;
        }
        if (block.attachments) {
          const att = findBlockAtLine(block.attachments, line);
          if (att) return att;
        }
        return block;
      }
    }
    return null;
  }

  onMessage((message) => {
    receivingFromHost = true;
    try {
      switch (message.type) {
        case "INIT":
          if (!initialized) {
            blockStore.setBlocks(message.payload.blocks);
            initialized = true;
            if (message.payload.config?.defaultZoom) {
              uiState.setZoom(message.payload.config.defaultZoom);
            }
          } else {
            blockStore.reconcileBlocks(message.payload.blocks);
          }
          uiState.setFileName(message.payload.fileName);
          break;

        case "UPDATE_BLOCKS":
          blockStore.reconcileBlocks(message.payload.blocks);
          if (message.payload.fileName) {
            uiState.setFileName(message.payload.fileName);
          }
          break;

        case "SYNC_STATUS":
          uiState.setSyncStatus(
            message.payload.status,
            message.payload.message,
          );
          break;

        case "PARSE_ERROR": {
          const firstError = message.payload.errors[0];
          uiState.setSyncStatus("error", firstError.message);
          break;
        }

        case "CURSOR_HIGHLIGHT": {
          const line = message.payload.line;
          if (line == null) {
            uiState.setCursorHighlight(null);
          } else {
            const found = findBlockAtLine(blockStore.blocks, line);
            uiState.setCursorHighlight(found?.id ?? null);
          }
          break;
        }
      }
    } finally {
      lastBlocksJson = JSON.stringify(blockStore.blocks);
      receivingFromHost = false;
    }
  });

  // --- Auto-save: debounced sync to host ---
  const triggerAutoSave = debounce(() => {
    if (uiState.autoSave && dragState.data.phase === "idle") {
      uiState.setSyncStatus("syncing");
      send({
        type: "REQUEST_SYNC",
        payload: { direction: "toCode", blocks: blockStore.blocks },
      });
    }
  }, 200);

  // React to block changes — notify host + auto-save.
  // Skips when: not yet initialized, or receiving blocks from host.
  let lastBlocksJson = "";
  $effect(() => {
    const json = JSON.stringify(blockStore.blocks);
    if (json !== lastBlocksJson) {
      lastBlocksJson = json;

      if (!initialized || receivingFromHost) return;

      saveState({ blocks: blockStore.blocks, zoom: uiState.zoomLevel });
      send({ type: "BLOCKS_CHANGED", payload: { blocks: blockStore.blocks } });

      if (uiState.autoSave) {
        triggerAutoSave();
      }
    }
  });

  // --- Collect all block IDs (for Ctrl+A) ---
  function collectAllBlockIds(blocks: Block[]): string[] {
    const ids: string[] = [];
    for (const b of blocks) {
      ids.push(b.id);
      if (b.children) ids.push(...collectAllBlockIds(b.children));
      if (b.attachments) ids.push(...collectAllBlockIds(b.attachments));
    }
    return ids;
  }

  // --- Check if the active element is a text input ---
  function isTextInput(el: Element | null): boolean {
    if (!el) return false;
    const tag = (el as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return true;
    if ((el as HTMLElement).isContentEditable) return true;
    return false;
  }

  // After undo/redo/delete, Svelte re-renders the block tree and the
  // browser auto-focuses the first focusable element (the search input).
  // This forces focus back to the canvas after the DOM settles.
  function refocusCanvas() {
    requestAnimationFrame(() => {
      const canvas = document.querySelector(
        ".vp-canvas-container",
      ) as HTMLElement | null;
      if (canvas) canvas.focus();
    });
  }

  // --- Keyboard shortcuts ---
  // ALL app-level shortcuts are disabled when focused inside a text field.
  function onKeyDown(e: KeyboardEvent) {
    if (isTextInput(e.target as Element)) return;

    if (e.ctrlKey && e.key === "z") {
      e.preventDefault();
      e.stopImmediatePropagation();
      blockStore.undo();
      refocusCanvas();
    } else if (e.ctrlKey && e.key === "y") {
      e.preventDefault();
      e.stopImmediatePropagation();
      blockStore.redo();
      refocusCanvas();
    } else if (e.key === "a") {
      // Bare "a" key to select/deselect all blocks
      // (Ctrl+A is intercepted by VS Code for text highlight)
      e.preventDefault();
      const allIds = collectAllBlockIds(blockStore.blocks);
      uiState.selectAll(allIds);
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      uiState.zoomIn();
    } else if (e.key === "-") {
      e.preventDefault();
      uiState.zoomOut();
    } else if (e.key === "0") {
      e.preventDefault();
      uiState.resetZoom();
    } else if (e.key === "Delete") {
      e.preventDefault();
      if (uiState.selectedBlockIds.length > 0) {
        blockStore.removeBlocks([...uiState.selectedBlockIds]);
        uiState.clearSelection();
      }
      refocusCanvas();
    } else if (e.key === "Escape") {
      uiState.hideContextMenu();
    } else if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      const ids = [...uiState.selectedBlockIds];
      if (ids.length > 0) {
        const blocks = ids
          .map((id) => blockStore.findBlock(id))
          .filter(Boolean);
        uiState.clipboard = JSON.parse(JSON.stringify(blocks));
      }
    } else if (e.ctrlKey && e.key === "v") {
      e.preventDefault();
      if (uiState.clipboard) {
        const items = Array.isArray(uiState.clipboard)
          ? uiState.clipboard
          : [uiState.clipboard];
        const clones = items.map((item) => {
          const clone = JSON.parse(JSON.stringify(item));
          reId(clone);
          return clone;
        });
        blockStore.insertBlocks(clones, null);
      }
    } else if (e.ctrlKey && e.key === "d") {
      e.preventDefault();
      const ids = [...uiState.selectedBlockIds];
      if (ids.length > 0) {
        blockStore.duplicateBlocks(ids);
      }
    }
  }

  function reId(block: any) {
    block.id = generateId();
    if (block.children) block.children.forEach(reId);
    if (block.attachments) block.attachments.forEach(reId);
  }

  // Tell the extension host we're ready
  send({ type: "READY" });

  function handleGlobalClick(e: MouseEvent) {
    if (uiState.contextMenu.visible) return; // ContextMenu handles its own close
    const target = e.target as HTMLElement;
    if (
      target.closest(
        ".vp-block, button, input, textarea, select, .vp-palette-item, .vp-context-menu",
      )
    )
      return;

    uiState.clearSelection();
  }
</script>

<svelte:document onkeydown={onKeyDown} onclick={handleGlobalClick} />

<div class="vp-app" role="application" aria-label="VisualPy Block Editor">
  <Toolbar />
  <div class="vp-main">
    <Palette />
    <Canvas />
  </div>
  <ContextMenu />
  <Toast />
</div>

<style>
  .vp-app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    opacity: 0;
    animation: vp-fade-in 300ms ease forwards;
    animation-delay: 50ms;
  }

  .vp-main {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }
</style>
