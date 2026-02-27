<script lang="ts">
    interface Props {
        value: string;
        options: string[];
        placeholder?: string;
        onChange?: (event: Event) => void;
    }

    let {
        value,
        options,
        placeholder = "op",
        onChange = () => {},
    }: Props = $props();
</script>

<div class="vp-operator-cell">
    <select
        class="vp-operator-select"
        value={value}
        title="Operator"
        onkeydown={(event) => event.stopPropagation()}
        onclick={(event) => event.stopPropagation()}
        onchange={onChange}
    >
        <option value="">{placeholder}</option>
        {#each options as op}
            <option value={op}>{op}</option>
        {/each}
    </select>
    <span class="vp-operator-arrow">▾</span>
</div>

<style>
    .vp-operator-cell {
        position: relative;
        display: inline-flex;
        align-items: center;
        border-radius: 7px;
    }

    .vp-operator-select {
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        padding: 3px 18px 3px 8px;
        font-family: var(--vp-mono);
        font-size: 11px;
        color: color-mix(in srgb, var(--vp-fg) 85%, transparent);
        border: 1px solid transparent;
        border-radius: 7px;
        background: transparent;
        cursor: pointer;
        transition:
            background var(--vp-transition-fast),
            border-color var(--vp-transition-fast);
    }

    .vp-operator-cell:hover .vp-operator-select,
    .vp-operator-select:focus {
        background: color-mix(in srgb, var(--vp-input-bg) 72%, transparent);
        border-color: color-mix(in srgb, var(--vp-input-border) 78%, transparent);
    }

    .vp-operator-arrow {
        position: absolute;
        right: 6px;
        font-size: 10px;
        color: color-mix(in srgb, var(--vp-fg) 70%, transparent);
        opacity: 0;
        pointer-events: none;
        transform: translateY(1px);
        transition: opacity var(--vp-transition-fast);
    }

    .vp-operator-cell:hover .vp-operator-arrow,
    .vp-operator-cell:focus-within .vp-operator-arrow {
        opacity: 0.9;
    }

    @media (hover: none) {
        .vp-operator-arrow {
            opacity: 0.82;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .vp-operator-select,
        .vp-operator-arrow {
            transition: none;
        }
    }
</style>
