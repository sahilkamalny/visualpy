<script lang="ts">
  import Toolbar from "./components/Toolbar.svelte";
  import Palette from "./components/Palette.svelte";
  import Canvas from "./components/Canvas.svelte";
  import ContextMenu from "./components/ContextMenu.svelte";
  import { blockStore } from "./lib/stores/blockStore.svelte";
  import { uiState } from "./lib/stores/uiState.svelte";
  import { dragState } from "./lib/stores/dragState.svelte";
  import { send, onMessage, saveState } from "./lib/bridge";
  import { debounce } from "./lib/utils";
  import type { Block } from "./lib/types";

  // --- Extension host message handler ---
  onMessage((message) => {
    switch (message.type) {
      case "INIT":
        blockStore.setBlocks(message.payload.blocks);
        uiState.setFileName(message.payload.fileName);
        if (message.payload.config?.defaultZoom) {
          uiState.setZoom(message.payload.config.defaultZoom);
        }
        break;

      case "UPDATE_BLOCKS":
        blockStore.updateBlocks(message.payload.blocks);
        if (message.payload.fileName) {
          uiState.setFileName(message.payload.fileName);
        }
        break;

      case "SYNC_STATUS":
        uiState.setSyncStatus(message.payload.status);
        break;
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
  }, 800);

  // React to block changes — notify host + auto-save
  let lastBlocksJson = "";
  $effect(() => {
    const json = JSON.stringify(blockStore.blocks);
    if (json !== lastBlocksJson) {
      lastBlocksJson = json;

      // Persist state for webview lifecycle
      saveState({ blocks: blockStore.blocks, zoom: uiState.zoomLevel });

      // Notify extension host of changes
      send({ type: "BLOCKS_CHANGED", payload: { blocks: blockStore.blocks } });

      // Auto-save
      if (uiState.autoSave) {
        triggerAutoSave();
      }
    }
  });

  // --- Keyboard shortcuts ---
  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

    if (e.ctrlKey && e.key === "z") {
      e.preventDefault();
      blockStore.undo();
    } else if (e.ctrlKey && e.key === "y") {
      e.preventDefault();
      blockStore.redo();
    } else if (e.key === "Delete") {
      e.preventDefault();
      if (uiState.selectedBlockId) {
        blockStore.removeBlock(uiState.selectedBlockId);
        uiState.selectBlock(null);
      }
    } else if (e.key === "Escape") {
      uiState.selectBlock(null);
      uiState.hideContextMenu();
    }
  }

  // Tell the extension host we're ready
  send({ type: "READY" });
</script>

<svelte:document onkeydown={onKeyDown} />

<div class="vp-app" role="application" aria-label="VisualPy Block Editor">
  <Toolbar />
  <div class="vp-main">
    <Palette />
    <Canvas />
  </div>
  <ContextMenu />
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
