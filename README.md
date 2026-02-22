# VisualPy

**Bidirectional Python ↔ visual block editor for VS Code — convert code to Scratch-like blocks and back, in real time.**

**Built with** TypeScript · VS Code Extension API · Node.js · HTML/CSS · npm

![VisualPy Demo](resources/demo.gif)

---

## Overview

VisualPy is a VS Code extension that renders Python source files as interactive visual block diagrams and keeps them in sync bidirectionally. Editing a block updates the code; editing the code updates the blocks. It targets learners bridging the gap from block-based environments like Scratch to real Python, while remaining useful to experienced developers who want a structural view of control flow and nesting.

---

## Compatibility

Works with VS Code 1.70.0+ and any VS Code-based IDE, including Cursor, Windsurf, Google Antigravity, and VSCodium.

---

## Features

**Bidirectional Sync** — Changes in the code editor and the block canvas propagate to each other automatically. Sync mode is configurable: `manual`, `onSave`, or `realtime`.

**Interactive Cursor Sync** — Clicking a line in the code editor focuses the corresponding block in the canvas.

**Block Palette** — Color-coded palette covering the full range of standard Python constructs (see [Supported Constructs](#supported-python-constructs) below).

**Infinite Canvas** — Smooth zoom and pan with minimap overview; zoom range 50–200%.

**Multi-Selection** — Select, move, copy, and delete multiple blocks simultaneously.

**Full Undo / Redo** — Complete edit history within the session.

**Theme Aware** — Automatically adapts to the active VS Code theme (Dark / Light / High Contrast).

---

## Quick Start

1. Open any Python file (`.py`)
2. Press `Ctrl+Shift+B` (`⌘+Shift+B` on macOS)
3. The VisualPy panel opens beside your code
4. Drag blocks from the palette onto the canvas to build logic
5. Edit values inline within blocks
6. Save the file (or press Sync) — the Python source updates instantly

---

## Supported Python Constructs

| Category | Constructs |
|---|---|
| Imports | `import`, `from ... import` |
| Variables | Assignment (`=`), augmented (`+=`, `-=`), typed assignment |
| Functions | `def`, `async def`, `return`, `yield` |
| Control Flow | `if`, `elif`, `else` |
| Loops | `for`, `while`, `break`, `continue` |
| Error Handling | `try`, `except`, `finally`, `raise`, `assert` |
| Classes | Class definitions |
| Context Managers | `with` statements |
| Miscellaneous | Comments, expressions, `pass` |

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Open block editor | `Ctrl+Shift+B` / `⌘+Shift+B` |
| Undo | `Ctrl+Z` / `⌘+Z` |
| Redo | `Ctrl+Y` / `⌘+Y` |
| Select / deselect all | `A` |
| Cancel selection | `Escape` |
| Delete selection | `Delete` |
| Duplicate | `Ctrl+D` / `⌘+D` |
| Copy / Paste | `Ctrl+C` / `Ctrl+V` — `⌘+C` / `⌘+V` |
| Zoom in | `+` or `=` |
| Zoom out | `-` or `_` |
| Reset zoom | `0` |

---

## Configuration

All settings are available in VS Code Settings (`Ctrl+,` / `⌘+,`) under the `visualpy` namespace.

| Setting | Default | Description |
|---|:---:|---|
| `visualpy.syncMode` | `onSave` | When to sync blocks to code: `manual`, `onSave`, or `realtime` |
| `visualpy.indentSize` | `4` | Spaces per indentation level |
| `visualpy.indentStyle` | `spaces` | `spaces` or `tabs` |
| `visualpy.defaultZoom` | `100` | Initial canvas zoom level (50–200) |
| `visualpy.showMinimap` | `true` | Show minimap overview on the canvas |
| `visualpy.palettePosition` | `left` | Block palette position: `left`, `right`, or `hidden` |
| `visualpy.pythonPath` | *(auto)* | Override path to Python executable |

---

## Requirements

- VS Code 1.70.0 or higher
- Python 3.x on PATH
- Recommended: [Python extension for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-python.python)

---

## Development

**Prerequisites:** Node.js 16.x+, Git

```bash
# Clone and install
git clone https://github.com/visualpy/visualpy.git
cd visualpy
npm install
```

**Run the extension:** Open the project in VS Code and press `F5`. This compiles the project and launches the Extension Development Host.

**Watch mode (hot reload):** Press `Ctrl+Shift+B` / `⌘+Shift+B` and select **Watch All**. Reload the Extension Development Host window (`Ctrl+R` / `⌘+R`) to pick up changes.

---

## Troubleshooting

**`Cannot find module 'dist/extension.js'`** — The extension must be compiled before it can run. Press `F5` to build and launch, or run `npm run dev` manually.

**Black screen on load** — Ensure `npm install` has been run. Check the developer console for errors via Help → Toggle Developer Tools.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

*Developed by [Sahil Kamal](https://sahilkamal.dev) for the Python community.*
