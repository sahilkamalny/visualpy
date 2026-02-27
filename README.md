<div align="center">

# VisualPy

**Bidirectional Python ↔ visual block editor for VS Code — convert code to Scratch-like blocks and back, in real time.**

[![CI](https://github.com/visualpy/visualpy/actions/workflows/ci.yml/badge.svg)](https://github.com/visualpy/visualpy/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5.0-FF3E00?style=flat-square&logo=svelte&logoColor=white)](https://svelte.dev/)
[![VS Code API](https://img.shields.io/badge/VS_Code_API-Extension-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/api)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

**Built with** Svelte · TypeScript · VS Code Extension API · Node.js

[Portfolio](https://sahilkamal.dev) · [LinkedIn](https://linkedin.com/in/sahilkamalny) · [Contact](mailto:sahilkamal.dev@gmail.com)

</div>

---

## Overview

VisualPy is a VS Code extension that renders Python source files as interactive visual block diagrams (Scratch-style, but for real Python) and keeps the code and blocks in sync bidirectionally. Editing a block updates the source; editing the source updates the blocks. It targets learners transitioning from block-based environments to text-based programming, while remaining useful to any developer who wants a structural view of control flow and nesting.

---

## Demo

![VisualPy Demo](resources/demo.gif)

---

## Compatibility

Works with VS Code 1.70.0+ and any VS Code-based IDE, including Cursor, Windsurf, and VSCodium.

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

## Tech Stack

| Layer | Technologies |
|---|---|
| Extension Host | TypeScript, VS Code Extension API, webpack |
| Webview UI | Svelte 5, TypeScript, Vite |
| Styling | CSS, VS Code theme tokens |

---

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup instructions.
For manual regression and release QA, see [docs/qa-checklists.md](docs/qa-checklists.md).

**Quick start:** clone the repo, run `npm install`, then press **F5** in VS Code. The extension compiles and launches automatically in a new Extension Development Host window. Subsequent file changes are compiled in the background — reload the dev host (`Cmd+R` / `Ctrl+R`) to pick them up.

---

## Troubleshooting

**`Cannot find module 'dist/extension.js'`** — Press `F5` to compile and launch. If that fails, check the Terminal panel for build errors.

**Black screen on load** — Ensure `npm install` has been run. Inspect errors via Help → Toggle Developer Tools.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Contact

**Sahil Kamal** — Full-Stack Developer

[sahilkamal.dev](https://sahilkamal.dev) · [linkedin.com/in/sahilkamalny](https://linkedin.com/in/sahilkamalny) · [sahilkamal.dev@gmail.com](mailto:sahilkamal.dev@gmail.com)

---

<div align="center">

*© 2026 Sahil Kamal*

</div>
