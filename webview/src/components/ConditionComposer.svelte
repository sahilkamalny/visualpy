<script lang="ts">
    import { blockStore } from "../lib/stores/blockStore.svelte";
    import { debounce } from "../lib/utils";
    import OperatorChip from "./OperatorChip.svelte";
    import {
        addConditionPair,
        CONDITION_OPERATORS,
        getParenthesisCounts,
        normalizeConditionModel,
        parseConditionExpression,
        removeConditionPair,
        serializeConditionExpression,
        toggleParenthesisPair,
        type ConditionModel,
        type ConditionOperator,
    } from "../lib/conditionComposer";

    interface Props {
        blockId: string;
        fieldId: string;
        value: string;
        suggestionListId?: string;
    }

    const SHIFT_HINT_KEY = "visualpy.conditionComposer.shiftHintSeen";

    let {
        blockId,
        fieldId,
        value,
        suggestionListId = "vp-symbol-cache",
    }: Props = $props();

    let composerEl: HTMLElement;
    let model = $state<ConditionModel>(parseConditionExpression(""));
    let shiftAnchor = $state<number | null>(null);
    let isFocused = $state(false);
    let isHovering = $state(false);
    let hintSeen = $state(readHintSeen());
    let focusStartValue = "";
    let lastParsedValue = "";

    const parenCounts = $derived(getParenthesisCounts(model));
    const canRemovePair = $derived(model.values.length > 1);
    const showHint = $derived(
        !hintSeen && isHovering && model.values.length >= 2,
    );

    const debouncedFlush = debounce(() => {
        blockStore.flushFieldUpdate();
    }, 300);

    function readHintSeen(): boolean {
        try {
            return localStorage.getItem(SHIFT_HINT_KEY) === "1";
        } catch {
            return false;
        }
    }

    function markHintSeen(): void {
        if (hintSeen) return;
        hintSeen = true;
        try {
            localStorage.setItem(SHIFT_HINT_KEY, "1");
        } catch {
            // noop
        }
    }

    $effect(() => {
        const incoming = value || "";
        if (isFocused) return;
        if (incoming === lastParsedValue) return;
        model = parseConditionExpression(incoming);
        lastParsedValue = incoming;
        shiftAnchor = null;
    });

    function beginEditing(): void {
        if (isFocused) return;
        isFocused = true;
        focusStartValue = value || "";
        blockStore.activeEditField = { blockId, fieldId };
        blockStore.saveSnapshot();
    }

    function finishEditing(): void {
        if (!isFocused) return;
        isFocused = false;
        blockStore.activeEditField = null;
        blockStore.flushFieldUpdate();

        const finalValue = serializeConditionExpression(model);
        if (finalValue === focusStartValue) {
            blockStore.discardSnapshot();
        }
    }

    function commit(nextModel: ConditionModel): void {
        model = normalizeConditionModel(nextModel);
        const serialized = serializeConditionExpression(model);
        blockStore.updateFieldQuiet(blockId, fieldId, serialized);
        debouncedFlush();
    }

    function handleFocusIn(event: FocusEvent): void {
        event.stopPropagation();
        beginEditing();
    }

    function handleFocusOut(event: FocusEvent): void {
        const next = event.relatedTarget as Node | null;
        if (next && composerEl?.contains(next)) {
            return;
        }
        finishEditing();
    }

    function handleValueClick(index: number, event: MouseEvent): void {
        event.stopPropagation();
        beginEditing();

        if (!event.shiftKey) {
            shiftAnchor = null;
            return;
        }

        event.preventDefault();
        markHintSeen();

        if (shiftAnchor == null) {
            shiftAnchor = index;
            return;
        }

        if (shiftAnchor === index) {
            shiftAnchor = null;
            return;
        }

        commit(toggleParenthesisPair(model, shiftAnchor, index));
        shiftAnchor = null;
    }

    function handleValueInput(index: number, event: Event): void {
        const target = event.target as HTMLInputElement;
        const nextValues = [...model.values];
        nextValues[index] = target.value;
        commit({
            ...model,
            values: nextValues,
        });
    }

    function handleOperatorChange(index: number, event: Event): void {
        const target = event.target as HTMLSelectElement;
        const nextOperators = [...model.operators];
        nextOperators[index] = target.value as ConditionOperator;
        commit({
            ...model,
            operators: nextOperators,
        });
    }

    function handleAddPair(event: MouseEvent): void {
        event.stopPropagation();
        beginEditing();
        commit(addConditionPair(model));
    }

    function handleRemovePair(event: MouseEvent): void {
        event.stopPropagation();
        if (!canRemovePair) return;
        beginEditing();
        commit(removeConditionPair(model));
        shiftAnchor = null;
    }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
    class="vp-condition-composer"
    bind:this={composerEl}
    data-composer-field={fieldId}
    role="group"
    tabindex="-1"
    onfocusin={handleFocusIn}
    onfocusout={handleFocusOut}
    onmouseenter={() => (isHovering = true)}
    onmouseleave={() => (isHovering = false)}
    onmousedown={(event) => event.stopPropagation()}
    onclick={(event) => event.stopPropagation()}
    onkeydown={(event) => event.stopPropagation()}
>
    <div class="vp-condition-values">
        {#each model.values as itemValue, index (index)}
            {@const displayValue = itemValue || `val ${index + 1}`}
            <div class="vp-value-cell" class:anchor={shiftAnchor === index}>
                {#if parenCounts.openCounts[index] > 0}
                    <span class="vp-paren vp-paren-open"
                        >{"(".repeat(parenCounts.openCounts[index])}</span
                    >
                {/if}

                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="vp-value-editor"
                    onclick={(event) => handleValueClick(index, event)}
                >
                    <span class="vp-value-render" class:placeholder={!itemValue}
                        >{displayValue}</span
                    >
                    <input
                        type="text"
                        class="vp-value-input"
                        value={itemValue}
                        placeholder={`val ${index + 1}`}
                        list={suggestionListId}
                        oninput={(event) => handleValueInput(index, event)}
                        onkeydown={(event) => event.stopPropagation()}
                    />
                </div>

                {#if parenCounts.closeCounts[index] > 0}
                    <span class="vp-paren vp-paren-close"
                        >{")".repeat(parenCounts.closeCounts[index])}</span
                    >
                {/if}
            </div>

            {#if index < model.operators.length}
                <OperatorChip
                    value={model.operators[index]}
                    options={CONDITION_OPERATORS}
                    placeholder="op"
                    onChange={(event) => handleOperatorChange(index, event)}
                />
            {/if}
        {/each}
    </div>

    <div class="vp-condition-controls">
        <button
            class="vp-condition-btn"
            type="button"
            title="Add operator/value pair"
            aria-label="Add operator value pair"
            onclick={handleAddPair}>+</button
        >
        <button
            class="vp-condition-btn"
            type="button"
            title="Remove last operator/value pair"
            aria-label="Remove operator value pair"
            disabled={!canRemovePair}
            onclick={handleRemovePair}>−</button
        >
    </div>

    {#if showHint}
        <div class="vp-shift-hint" role="note">
            <button
                class="vp-shift-hint-close"
                type="button"
                aria-label="Dismiss tutorial hint"
                onclick={() => markHintSeen()}>✕</button
            >
            <div class="vp-shift-hint-keys">
                <kbd>SHIFT</kbd>
                <span>+</span>
                <kbd>CLICK</kbd>
                <span class="vp-shift-hint-pointer">🖱</span>
            </div>
            <div class="vp-shift-hint-demo">
                <span class="vp-demo-chip">val 1</span>
                <span class="vp-demo-chip">val 2</span>
            </div>
            <p>Shift-click two values to add or remove one parentheses pair.</p>
        </div>
    {/if}
</div>

<style>
    .vp-condition-composer {
        position: relative;
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
        min-width: 0;
    }

    .vp-condition-values {
        display: flex;
        align-items: center;
        gap: 4px;
        min-width: 0;
        flex: 1 1 auto;
        flex-wrap: wrap;
    }

    .vp-value-cell {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        border-radius: 8px;
    }

    .vp-value-cell.anchor .vp-value-editor {
        box-shadow: 0 0 0 1px
            color-mix(in srgb, var(--vp-focus) 75%, transparent);
        border-radius: 8px;
    }

    .vp-paren {
        font-family: var(--vp-mono);
        font-size: 13px;
        color: color-mix(in srgb, var(--vp-fg) 78%, transparent);
        letter-spacing: -0.4px;
        user-select: none;
    }

    .vp-value-editor {
        position: relative;
        min-width: 64px;
        max-width: 200px;
        border-radius: 8px;
    }

    .vp-value-render {
        display: block;
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

    .vp-value-render.placeholder {
        opacity: 0.45;
        font-style: italic;
    }

    .vp-value-input {
        position: absolute;
        inset: 0;
        width: 100%;
        min-width: 64px;
        padding: 4px 8px;
        font-family: var(--vp-mono);
        font-size: 12px;
        color: transparent;
        caret-color: var(--vp-input-fg);
        background: transparent;
        border: 1px solid transparent;
        border-radius: 8px;
        opacity: 0;
        transition:
            opacity var(--vp-transition-fast),
            color var(--vp-transition-fast),
            background var(--vp-transition-fast),
            border-color var(--vp-transition-fast);
    }

    .vp-value-editor:hover .vp-value-input,
    .vp-value-editor:focus-within .vp-value-input {
        opacity: 1;
        color: var(--vp-input-fg);
        background: var(--vp-input-bg);
        border-color: var(--vp-input-border);
    }

    .vp-value-editor:hover .vp-value-render,
    .vp-value-editor:focus-within .vp-value-render {
        opacity: 0;
    }

    .vp-value-input:focus {
        border-color: var(--vp-focus);
        box-shadow: 0 0 0 1px var(--vp-focus);
    }

    .vp-condition-controls {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        opacity: 0;
        transform: translateX(-6px);
        transition:
            opacity var(--vp-transition-fast),
            transform var(--vp-transition-fast);
        pointer-events: none;
        margin-left: 4px;
    }

    .vp-condition-composer:hover .vp-condition-controls,
    .vp-condition-composer:focus-within .vp-condition-controls {
        opacity: 0.78;
        transform: translateX(0);
        pointer-events: auto;
    }

    .vp-condition-btn {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        border: 1px solid transparent;
        background: color-mix(in srgb, var(--vp-fg) 10%, transparent);
        color: color-mix(in srgb, var(--vp-fg) 86%, transparent);
        font-family: var(--vp-mono);
        font-size: 12px;
        line-height: 1;
        cursor: pointer;
        transition:
            background var(--vp-transition-fast),
            border-color var(--vp-transition-fast);
    }

    .vp-condition-btn:hover:not(:disabled) {
        background: color-mix(in srgb, var(--vp-focus) 18%, transparent);
        border-color: color-mix(in srgb, var(--vp-focus) 50%, transparent);
    }

    .vp-condition-btn:focus-visible {
        outline: none;
        border-color: color-mix(in srgb, var(--vp-focus) 65%, transparent);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--vp-focus) 65%, transparent);
    }

    .vp-condition-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }

    .vp-shift-hint {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        z-index: 7;
        width: 250px;
        padding: 10px 12px;
        border-radius: 16px;
        background: radial-gradient(
            circle at 20% 20%,
            color-mix(in srgb, var(--vp-focus) 20%, transparent),
            color-mix(in srgb, var(--vp-bg) 92%, black)
        );
        border: 1px solid color-mix(in srgb, var(--vp-border) 72%, var(--vp-focus));
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        animation: vp-shift-hint-float 3.2s ease-in-out infinite;
    }

    .vp-shift-hint-close {
        position: absolute;
        top: 6px;
        right: 8px;
        border: none;
        background: transparent;
        color: color-mix(in srgb, var(--vp-fg) 70%, transparent);
        cursor: pointer;
    }

    .vp-shift-hint-keys {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        font-size: 11px;
    }

    .vp-shift-hint-keys kbd {
        min-width: 42px;
        text-align: center;
        padding: 2px 6px;
        border-radius: 6px;
        border: 1px solid color-mix(in srgb, var(--vp-focus) 55%, transparent);
        background: color-mix(in srgb, var(--vp-focus) 17%, transparent);
        color: var(--vp-fg);
        animation: vp-shift-hint-blink 1.4s ease-in-out infinite;
    }

    .vp-shift-hint-pointer {
        font-size: 13px;
        filter: saturate(0.7);
    }

    .vp-shift-hint-demo {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
    }

    .vp-demo-chip {
        padding: 3px 7px;
        border-radius: 7px;
        border: 1px solid color-mix(in srgb, var(--vp-focus) 45%, transparent);
        background: color-mix(in srgb, var(--vp-focus) 12%, transparent);
        font-family: var(--vp-mono);
        font-size: 11px;
        animation: vp-shift-hint-select 1.4s ease-in-out infinite;
    }

    .vp-shift-hint p {
        font-size: 11px;
        line-height: 1.4;
        opacity: 0.82;
    }

    @media (max-width: 860px) {
        .vp-condition-composer {
            flex-wrap: wrap;
            gap: 4px;
        }

        .vp-condition-values {
            flex: 1 0 100%;
        }

        .vp-condition-controls {
            margin-left: 0;
            transform: translateX(0);
        }

        .vp-shift-hint {
            width: min(250px, calc(100vw - 56px));
        }
    }

    @media (hover: none) {
        .vp-condition-controls {
            opacity: 0.82;
            transform: translateX(0);
            pointer-events: auto;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .vp-condition-controls,
        .vp-value-input,
        .vp-value-render {
            transition: none;
        }

        .vp-shift-hint,
        .vp-shift-hint-keys kbd,
        .vp-demo-chip {
            animation: none;
        }
    }

    @keyframes vp-shift-hint-float {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-2px);
        }
    }

    @keyframes vp-shift-hint-blink {
        0%,
        100% {
            opacity: 0.95;
        }
        50% {
            opacity: 0.55;
        }
    }

    @keyframes vp-shift-hint-select {
        0%,
        100% {
            background: color-mix(in srgb, var(--vp-focus) 8%, transparent);
        }
        50% {
            background: color-mix(in srgb, var(--vp-focus) 25%, transparent);
        }
    }
</style>
