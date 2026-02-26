# Contributing to VisualPy

Thanks for your interest in contributing! Here's how to get started.

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [VS Code](https://code.visualstudio.com/)

## Setup

```bash
git clone https://github.com/visualpy/visualpy
cd visualpy
npm install        # also installs webview dependencies automatically
```

When you open the project in VS Code, you'll be prompted to install the recommended extensions — accept to get ESLint, Svelte IntelliSense, and Error Lens set up automatically.

## Development

Press **F5** (or click **Run Extension** in the Run & Debug panel).

This will:
1. Start the webpack watcher for the extension (`src/`) and the Vite watcher for the webview (`webview/src/`) concurrently
2. Launch a new **Extension Development Host** window with VisualPy loaded

From there, edits to any source file are compiled automatically. To pick up changes, run **Developer: Restart Extension Host** (`Cmd+R` / `Ctrl+R`) in the Extension Development Host window.

## Project Structure

```
src/            # VS Code extension (TypeScript, compiled by webpack)
webview/src/    # Webview UI (Svelte + TypeScript, compiled by Vite)
dist/           # Build output (generated, do not edit)
resources/      # Static assets (icons, example files)
```

## Scripts

| Command | Description |
|---|---|
| `npm run watch` | Start both watchers (used automatically by F5) |
| `npm run compile` | One-shot production build |
| `npm run lint` | Run ESLint |
| `npm run package` | Package the extension as a `.vsix` |

## Code Style

- ESLint is configured — run `npm run lint` before submitting a PR
- 4-space indentation for TypeScript/Svelte, 2-space for JSON
