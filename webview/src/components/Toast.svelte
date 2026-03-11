<script lang="ts">
    import { uiState } from "../lib/stores/uiState.svelte";
</script>

{#if uiState.toast.visible}
    <div class="vp-toast" class:error={uiState.toast.type === "error"}>
        <span class="vp-toast-icon">
            {#if uiState.toast.type === "error"}
                ⚠️
            {:else}
                ℹ️
            {/if}
        </span>
        <span class="vp-toast-message">{uiState.toast.message}</span>
        <button
            class="vp-toast-close"
            onclick={() => (uiState.toast.visible = false)}>×</button
        >
    </div>
{/if}

<style>
    .vp-toast {
        position: absolute;
        bottom: 24px;
        right: 24px;
        background: var(--vp-bg-panel);
        border: 1px solid var(--vp-border);
        border-radius: 8px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        z-index: 2000;
        animation: slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        max-width: 400px;
        font-family: var(--vp-font-family);
    }

    .vp-toast.error {
        border-left: 4px solid var(--color-error, #f87171);
    }

    .vp-toast-message {
        font-size: 13px;
        color: var(--vp-fg);
        line-height: 1.4;
    }

    .vp-toast-close {
        background: none;
        border: none;
        color: var(--vp-fg-subtle);
        cursor: pointer;
        font-size: 18px;
        padding: 4px;
        line-height: 1;
        opacity: 0.7;
        transition: opacity 0.2s;
    }

    .vp-toast-close:hover {
        opacity: 1;
    }

    @keyframes slide-up {
        from {
            transform: translateY(20px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
</style>
