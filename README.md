# VisualPy

**Convert Python code to Scratch-like visual blocks and back** - a bidirectional visual programming experience for VS Code.

![VisualPy Demo](resources/demo.gif)

## ✨ Features

- **🔄 Bidirectional Conversion**: Seamlessly convert between Python code and visual blocks
- **🎨 Beautiful Block Palette**: Drag and drop blocks for all Python constructs
- **⌨️ Keyboard Navigation**: Full keyboard support with arrow keys, shortcuts
- **🔍 Zoom & Pan**: Ctrl+scroll to zoom, smooth pan across your code
- **↩️ Undo/Redo**: Full history with Ctrl+Z/Ctrl+Y
- **🎯 Sync Modes**: Manual, on-save, or real-time synchronization
- **🌙 Theme Support**: Automatically adapts to VS Code's dark/light theme
- **♿ Accessible**: ARIA labels and keyboard navigation for screen readers

## 📋 Requirements
- VS Code 1.70.0 or higher
- **Python 3.x** installed and added to your PATH
- [Python extension for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-python.python) (recommended)

## 🚀 Quick Start

1. Open a Python file (`.py`)
2. Press **Ctrl+Shift+B** (or Cmd+Shift+B on Mac)
3. The block editor opens in a panel beside your code
4. Drag blocks from the palette, edit values, rearrange!
5. Click **Sync** to update your Python code

## 📦 Supported Python Constructs

| Category | Blocks |
|----------|--------|
| **Imports** | `import`, `from ... import` |
| **Variables** | Assignment, Augmented assignment |
| **Functions** | Function definition, Return |
| **Control** | If, Elif, Else |
| **Loops** | For, While, Break, Continue |
| **Exceptions** | Try, Except, Finally |
| **Classes** | Class definition |
| **Misc** | Pass, Comments, Expressions |

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Block Editor | `Ctrl+Shift+B` |
| Delete Block | `Delete` or `Backspace` |
| Duplicate Block | `Ctrl+D` |
| Copy Block | `Ctrl+C` |
| Paste Block | `Ctrl+V` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Y` |
| Navigate Up/Down | `↑` / `↓` |
| Jump to First/Last | `Home` / `End` |
| Collapse/Expand | `Enter` |
| Zoom In/Out | `Ctrl+Scroll` |
| Deselect | `Escape` |

## ⚙️ Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `visualpy.syncMode` | When to sync (manual/onSave/realtime) | `onSave` |
| `visualpy.indentSize` | Spaces for indentation | `4` |
| `visualpy.indentStyle` | Use spaces or tabs | `spaces` |
| `visualpy.defaultZoom` | Initial zoom level (50-200) | `100` |
| `visualpy.showMinimap` | Show minimap preview | `true` |
| `visualpy.palettePosition` | Palette position (left/right/hidden) | `left` |
| `visualpy.pythonPath` | Custom Python path | auto-detect |

## 🎓 Educational Use

VisualPy is perfect for:
- **Teaching Python**: Visualize code structure for beginners
- **Code Understanding**: See the flow of control at a glance
- **Rapid Prototyping**: Drag blocks faster than typing
- **Accessibility**: Alternative interface for different learning styles

## ❓ Troubleshooting

### Extension not loading / Black screen
- Ensure you have run `npm install` and `npm run compile` if running from source.
- Check the console for errors (Help > Toggle Developer Tools).

### Python not found
- Ensure Python 3 is installed.
- Install the official [Python extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python).
- Select your interpreter via `Python: Select Interpreter` command in VS Code.
- Alternatively, set `visualpy.pythonPath` in your settings to the absolute path of your python executable.

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/visualpy/visualpy.git
cd visualpy

# Install dependencies
npm install

# Compile
npm run compile

# Run extension (press F5 in VS Code)
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Made with ❤️ for the Python community**
