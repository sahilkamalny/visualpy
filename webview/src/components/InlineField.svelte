<script lang="ts">
    interface Props {
        value: string;
        label: string;
        placeholder?: string;
        suggestionListId?: string;
        mode?: "input" | "select";
        options?: string[];
        onInput?: (event: Event) => void;
        onFocus?: (event: FocusEvent) => void;
        onBlur?: (event: FocusEvent) => void;
    }

    let {
        value,
        label,
        placeholder = "",
        suggestionListId = "",
        mode = "input",
        options = [],
        onInput = () => {},
        onFocus = () => {},
        onBlur = () => {},
    }: Props = $props();

    const displayText = $derived(value || placeholder || label);
</script>

<div class="vp-inline-field" title={label}>
    <span class="vp-inline-field-text" class:placeholder={!value}>
        {displayText}
    </span>

    {#if mode === "select"}
        <select
            class="vp-field-select"
            value={value}
            oninput={onInput}
            onfocus={onFocus}
            onblur={onBlur}
            onkeydown={(event) => event.stopPropagation()}
            onclick={(event) => event.stopPropagation()}
        >
            {#each options as option}
                <option value={option}>{option}</option>
            {/each}
        </select>
        <span class="vp-field-select-arrow">▾</span>
    {:else}
        <input
            type="text"
            class="vp-field-input"
            value={value}
            placeholder={placeholder || label}
            list={suggestionListId || undefined}
            oninput={onInput}
            onfocus={onFocus}
            onblur={onBlur}
            onkeydown={(event) => event.stopPropagation()}
            onclick={(event) => event.stopPropagation()}
        />
    {/if}
</div>

<style>
    .vp-inline-field {
        position: relative;
        flex: 1 1 92px;
        min-width: 68px;
        max-width: 220px;
        border-radius: 8px;
    }

    .vp-inline-field-text {
        display: block;
        width: 100%;
        padding: 4px 8px;
        font-family: var(--vp-mono);
        font-size: 12px;
        line-height: 1.4;
        color: var(--vp-fg);
        border: 1px solid transparent;
        border-radius: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: opacity var(--vp-transition-fast);
        user-select: none;
    }

    .vp-inline-field-text.placeholder {
        opacity: 0.46;
        font-style: italic;
    }

    .vp-field-input {
        position: absolute;
        inset: 0;
        width: 100%;
        min-width: 68px;
        padding: 4px 8px;
        font-family: var(--vp-mono);
        font-size: 12px;
        background: transparent;
        color: transparent;
        caret-color: var(--vp-input-fg);
        border: 1px solid transparent;
        border-radius: 8px;
        opacity: 0;
        transition:
            opacity var(--vp-transition-fast),
            color var(--vp-transition-fast),
            border-color var(--vp-transition-fast),
            background var(--vp-transition-fast);
    }

    .vp-field-select {
        position: absolute;
        inset: 0;
        width: 100%;
        min-width: 68px;
        padding: 4px 20px 4px 8px;
        font-family: var(--vp-mono);
        font-size: 12px;
        color: transparent;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 8px;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        opacity: 0;
        transition:
            opacity var(--vp-transition-fast),
            color var(--vp-transition-fast),
            border-color var(--vp-transition-fast),
            background var(--vp-transition-fast);
    }

    .vp-field-select-arrow {
        position: absolute;
        right: 6px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 10px;
        color: color-mix(in srgb, var(--vp-fg) 68%, transparent);
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--vp-transition-fast);
    }

    .vp-inline-field:hover .vp-field-input,
    .vp-inline-field:focus-within .vp-field-input,
    .vp-inline-field:hover .vp-field-select,
    .vp-inline-field:focus-within .vp-field-select {
        opacity: 1;
        color: var(--vp-input-fg);
        background: var(--vp-input-bg);
        border-color: var(--vp-input-border);
    }

    .vp-inline-field:hover .vp-inline-field-text,
    .vp-inline-field:focus-within .vp-inline-field-text {
        opacity: 0;
    }

    .vp-inline-field:hover .vp-field-select-arrow,
    .vp-inline-field:focus-within .vp-field-select-arrow {
        opacity: 0.85;
    }

    .vp-field-input:focus {
        border-color: var(--vp-focus);
        box-shadow: 0 0 0 1px var(--vp-focus);
    }

    .vp-field-select:focus {
        border-color: var(--vp-focus);
        box-shadow: 0 0 0 1px var(--vp-focus);
    }

    .vp-field-input::placeholder {
        opacity: 0.4;
    }

    @media (hover: none), (pointer: coarse) {
        .vp-inline-field .vp-field-input,
        .vp-inline-field .vp-field-select {
            opacity: 1;
            color: var(--vp-input-fg);
            background: color-mix(in srgb, var(--vp-input-bg) 85%, transparent);
            border-color: color-mix(in srgb, var(--vp-input-border) 65%, transparent);
        }

        .vp-inline-field .vp-inline-field-text {
            opacity: 0;
        }

        .vp-inline-field .vp-field-select-arrow {
            opacity: 0.82;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .vp-field-input,
        .vp-field-select,
        .vp-inline-field-text,
        .vp-field-select-arrow {
            transition: none;
        }
    }
</style>
