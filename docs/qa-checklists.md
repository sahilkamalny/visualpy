# QA Checklists

This document is the manual QA reference for VisualPy interaction and sync behavior.
Run these checks after changes to UI state, drag/drop, selection, keyboard handling, sync, or parser/reconcile logic.

## Test Setup

- [ ] Use Node.js v20+ and current project dependencies (`npm install` at repo root).
- [ ] Launch extension in an **Extension Development Host** (press `F5` in VS Code).
- [ ] Open a Python file with enough constructs to produce 10+ blocks:
  - [ ] at least one nested `if`/`for`/`while`
  - [ ] at least one function definition
  - [ ] at least one `try/except` or `with`
- [ ] Open the block editor with `Ctrl+Shift+B` / `Cmd+Shift+B`.
- [ ] Keep the devtools console available for runtime errors.

## Execution Rules

- [ ] For each section below, mark Pass/Fail and capture a short note for failures.
- [ ] If a step fails, record:
  - [ ] exact action sequence
  - [ ] expected vs actual result
  - [ ] whether issue is deterministic or intermittent
  - [ ] screenshot/GIF if visual
- [ ] Re-test failed steps after fix and confirm no regression in adjacent behavior.

## Release Smoke (Always Run)

- [ ] Block editor opens from a Python file without a blank/black screen.
- [ ] Initial blocks render with correct nesting and structure.
- [ ] No uncaught runtime errors in console during startup.
- [ ] Basic block select, drag, and field edit all work once.
- [ ] Code-to-block and block-to-code sync each succeed once.

## Interaction Regression Checklist

### Selection and Lasso

- [ ] Start with at least 3 selectable blocks visible.
- [ ] Click empty canvas once to clear any prior selection.
- [ ] Click-drag a lasso across multiple blocks; release inside canvas.
- [ ] Confirm intersected blocks stay selected after mouseup.
- [ ] Repeat and release mouse outside canvas bounds.
- [ ] Confirm selection still persists (no unintended global click clear).
- [ ] Immediately after lasso mouseup, verify synthetic click does not clear selection.
- [ ] Next intentional empty-canvas click clears selection exactly once.

### Empty-Canvas Deselect Semantics

- [ ] With multiple blocks selected, single-click empty canvas (no drag).
- [ ] Confirm all selection clears.
- [ ] Select one block, then click empty canvas again.
- [ ] Confirm selection clears consistently and no double-toggle effect occurs.

### Native Text Selection Suppression

- [ ] Drag on empty canvas over visible labels/content.
- [ ] Confirm browser text highlight does not appear during lasso gesture.
- [ ] Drag-select text inside an editable block input.
- [ ] Confirm text selection still works inside input fields.

### Context Menu

- [ ] Right-click on a block opens block context menu.
- [ ] Right-click on empty canvas does not incorrectly select/deselect blocks.
- [ ] Closing context menu restores normal click behavior.

### Drag and Drop

- [ ] Drag a single block to reorder within same parent.
- [ ] Drag a block into a different valid container.
- [ ] Multi-select blocks and drag them together.
- [ ] Drag a palette item to canvas to create a new block.
- [ ] Verify drop indicator/displacement visuals behave correctly during drag.
- [ ] If trash/delete drop zone exists, drop over it and confirm expected delete behavior.

### Keyboard and Focus

- [ ] `A` toggles select-all/deselect-all on canvas.
- [ ] `Escape` clears selection and hides context menu.
- [ ] `Delete` removes selected blocks only when focus is not in text input.
- [ ] `Ctrl/Cmd+C` and `Ctrl/Cmd+V` copy/paste selected blocks.
- [ ] `Ctrl/Cmd+D` duplicates selected blocks.
- [ ] `Ctrl/Cmd+Z` / `Ctrl/Cmd+Y` (or platform equivalent) perform undo/redo correctly.
- [ ] While typing in a field input, global shortcuts do not interfere.

### Zoom and Navigation

- [ ] `+` / `=` zoom in.
- [ ] `-` / `_` zoom out.
- [ ] `0` resets zoom to default.
- [ ] Scrolling/panning remains smooth and does not break hit-testing.

## Data Integrity and Sync Checklist

### Block ↔ Code Sync

- [ ] Edit block field values and confirm Python source updates correctly.
- [ ] Edit Python source and confirm block tree reconciles without selection corruption.
- [ ] Rapid edits do not cause stale or reverted field values after debounce flush.

### Undo/Redo Integrity

- [ ] Make 3-5 structural edits (insert/move/delete).
- [ ] Undo step-by-step to initial state.
- [ ] Redo step-by-step to latest state.
- [ ] Confirm tree structure, selection state, and cursor highlight remain coherent.

### Collapse/Expand (If Applicable)

- [ ] Collapse a parent block with children and attachments.
- [ ] Confirm hidden children are not interactable while collapsed.
- [ ] Expand and confirm previous structure restores correctly.
- [ ] Confirm collapse state survives non-destructive operations (selection, zoom, sync update where expected).

## Visual and UX Sanity

- [ ] Selection styles clearly indicate selected vs non-selected blocks.
- [ ] Cursor highlight (code-to-block mapping) is visible and scrolls into view.
- [ ] Empty-state canvas visuals render correctly when no blocks exist.
- [ ] No flicker/jump artifacts on repeated lasso and drag cycles.

## Performance Sanity

- [ ] With a moderately large file (~100 blocks), lasso remains responsive.
- [ ] Dragging does not produce severe frame drops or frozen UI.
- [ ] Repeated selection/drag cycles do not progressively degrade responsiveness.

## Compatibility Spot Check

- [ ] Verify behavior in the target VS Code version for this release.
- [ ] If release-critical, spot-check one additional VS Code-based IDE (Cursor/Windsurf/VSCodium).

## Suggested Bug Report Template

Use this template for QA findings:

```md
### Summary
<one-line issue title>

### Environment
- VisualPy version/branch:
- VS Code (or IDE) version:
- OS:

### Repro Steps
1.
2.
3.

### Expected

### Actual

### Frequency
- [ ] Always
- [ ] Intermittent

### Notes
- Console errors:
- Screenshot/GIF:
```
