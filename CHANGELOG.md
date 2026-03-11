# Changelog

All notable changes to the VisualPy extension will be documented in this file.

## [0.1.0] - Initial Release

### Added
- **Bidirectional Conversion**: Seamlessly convert between Python code and visual blocks
- **Block Palette**: Drag and drop blocks for all Python constructs
  - Imports (import, from...import)
  - Variables (assignment, augmented assignment)
  - Functions (definition, return)
  - Control flow (if, elif, else)
  - Loops (for, while, break, continue)
  - Exceptions (try, except, finally)
  - Misc (pass, comment, expression)
- **Block Interaction**:
  - Click to select blocks
  - Drag and drop to reorder
  - Inline editing for block values
  - Context menu (right-click)
- **Keyboard Shortcuts**:
  - Ctrl+Shift+B: Open block editor
  - Delete: Remove selected block
  - Ctrl+D: Duplicate block
  - Ctrl+C/V: Copy/Paste blocks
  - Ctrl+Z/Y: Undo/Redo
  - Arrow keys: Navigate blocks
- **Zoom & Pan**:
  - Ctrl+Scroll to zoom (50-200%)
  - Zoom controls in toolbar
- **Synchronization Modes**:
  - Manual sync
  - On-save sync
  - Real-time sync
- **Theme Support**: Automatic dark/light mode detection
- **Accessibility**: ARIA labels, keyboard navigation

### Known Issues
- Minimap is CSS-ready but not yet interactive
- Some complex Python constructs may not be fully supported

---

For more information, see the [README](README.md).
