# VisualPy

**Convert Python code to Scratch-like visual blocks and back** - a bidirectional visual programming experience for VS Code.

![VisualPy Demo](resources/demo.gif)

## 🔌 Compatibility

Works seamlessly with:
- **VS Code** (v1.70.0+)
- **Cursor**
- **Google Antigravity**
- **Windsurf**
- **VSCodium**

## ✨ Features

- **🔄 Bidirectional Sync**: Seamlessly convert between Python code and visual blocks. Changes in one update the other.
- **📍 Interactive Cursor Sync**: Click a line in your code, and the corresponding block indents and scrolls into view automatically.
- **🎨 Modern Block Palette**: A beautiful, color-coded palette for all standard Python constructs.
- **⚡ Smart Features**:
    - **Undo/Redo**: Full history support with `Ctrl+Z` / `Ctrl+Y`.
    - **Zoom & Pan**: Infinite canvas with smooth zoom controls.
    - **Multi-Selection**: Select, move, copy, and delete multiple blocks at once.
- **🛠️ Auto Sync & Save**: Automatically syncs code updates to blocks and vice versa, unless toggled off.
- **🌙 Theme Aware**: Automatically adapts to your VS Code theme (Dark/Light/High Contrast).

## 🚀 Quick Start

1.  **Open a Python file** (`.py`).
2.  Press **`Ctrl+Shift+B`** (or `Cmd+Shift+B` on Mac).
3.  The **VisualPy** panel will open beside your code.
4.  **Drag & Drop** blocks from the palette to build your logic.
5.  **Edit** values directly in the blocks.
6.  **Save** your file (or use the Sync button) to see the Python code update instantly.

## 📋 Requirements

### For Users
- **VS Code**: Version 1.70.0 or higher.
- **Python**: Python 3.x installed and added to your PATH.
- **Recommended**: [Python extension for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-python.python).

> **Note:** End users do **not** need Node.js installed to use the extension.

## 📦 Supported Python Constructs

VisualPy supports a wide range of Python features, organized by category:

| Category | Blocks |
|----------|--------|
| **Imports** | `import`, `from ... import` |
| **Variables** | Assignment (`=`), Augmented (`+=`, `-=`), Typed Assignment |
| **Functions** | Definitions (`def`, `async def`), `return`, `yield` |
| **Control Flow** | `if`, `elif`, `else` |
| **Loops** | `for`, `while`, `break`, `continue` |
| **Error Handling** | `try`, `except`, `finally`, `raise`, `assert` |
| **Classes** | Class definitions |
| **Context** | `with` statements |
| **Misc** | Comments, Expressions, `pass` |

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| **Open Block Editor** | `Ctrl + Shift + B` |
| **Undo** | `Ctrl + Z` |
| **Redo** | `Ctrl + Y` |
| **Select/Deselect All** | `A` |
| **Cancel Selection** | `Escape` |
| **Delete Selection** | `Delete` |
| **Duplicate** | `Ctrl + D` |
| **Copy / Paste** | `Ctrl + C` / `Ctrl + V` |
| **Zoom In** | `+` or `=` |
| **Zoom Out** | `-` or `_` |
| **Reset Zoom** | `0` |

## ⚙️ Configuration

Customize VisualPy in your VS Code settings (`Ctrl+,`):

| Setting | Default | Description |
|---------|:-------:|-------------|
| `visualpy.syncMode` | `onSave` | When to sync blocks to code (`manual`, `onSave`, `realtime`). |
| `visualpy.indentSize` | `4` | Number of spaces for indentation. |
| `visualpy.indentStyle` | `spaces` | Use `spaces` or `tabs`. |
| `visualpy.defaultZoom` | `100` | Initial zoom level percentage (50-200). |
| `visualpy.showMinimap` | `true` | Show the minimap overview on the canvas. |
| `visualpy.palettePosition`| `left` | Position of the block palette (`left`, `right`, `hidden`). |
| `visualpy.pythonPath` | *(auto)* | Custom path to Python executable (optional). |

## 🎓 Educational Use

VisualPy is built to bridge the gap between block-based and text-based coding:

-   **Visualize Logic**: See the structure of control flow and nesting at a glance.
-   **Syntax Free**: Focus on logic first, then see the generated Python syntax.
-   **Real-world Python**: Unlike some educational tools, VisualPy generates standard, readable Python code that you can use anywhere.
-   **Accessibility**: Provides an alternative, mouse-friendly interface for code manipulation.

## 🛠️ Development

VisualPy is designed to be easy to set up and run.

### Prerequisites (Development Only)
-   **Node.js**: Version 16.x or higher.
-   **Git**: For cloning the repository.

### Setup Steps

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/visualpy/visualpy.git
    cd visualpy
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    # This automatically installs dependencies for both the extension and the webview
    ```

3.  **Run the Extension:**

    *   Open the project in VS Code.
    *   Press **F5**.
    *   This will automatically run the full build (`npm run dev`) and launch the Extension Development Host.

**For Active Development (Hot Reload):**

If you are actively modifying the code, you can enable watch mode to auto-rebuild on changes:

1.  Press **Ctrl+Shift+B** (or Cmd+Shift+B)
2.  Select **"Watch All"**
3.  This starts the watch task in a new terminal.

*Note: Do not press F5 while the watch task is running to avoid conflicts. Just use the already-open Extension Development Host window and reload it (Ctrl+R) to see changes.*

## ❓ Troubleshooting

### Extension not loading / Black screen
- Ensure you have run `npm install`.
- If the issue persists, try running `npm run dev` manually in the terminal to ensure a clean build.
- Check the console for errors (Help > Toggle Developer Tools).

### "Extension is already running"
- This usually happens if you try to launch (F5) while a watch task is running in the background. Kill any running terminals and try again.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Developed by Sahil Kamal for the Python community**