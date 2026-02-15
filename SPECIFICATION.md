# VisualPy: Python Visual Block Programming Extension

## Specification Document v1.0

> **Purpose**: This document serves as the complete technical specification for building VisualPy, a VS Code extension that provides bidirectional conversion between Python code and Scratch-like visual programming blocks.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Concepts & Terminology](#2-core-concepts--terminology)
3. [Feature Requirements](#3-feature-requirements)
4. [Technical Architecture](#4-technical-architecture)
5. [Python Parsing Strategy](#5-python-parsing-strategy)
6. [Block System Design](#6-block-system-design)
7. [User Interface Specification](#7-user-interface-specification)
8. [State Management & Synchronization](#8-state-management--synchronization)
9. [VS Code Integration](#9-vs-code-integration)
10. [File Structure & Project Organization](#10-file-structure--project-organization)
11. [Development Phases](#11-development-phases)
12. [Testing Strategy](#12-testing-strategy)
13. [Performance Considerations](#13-performance-considerations)
14. [Accessibility](#14-accessibility)
15. [Known Limitations & Future Scope](#15-known-limitations--future-scope)

---

## 1. Executive Summary

### 1.1 Project Description

**VisualPy** is a VS Code extension that enables developers to:
1. **Read & Visualize**: Parse existing Python code files and render them as interactive, Scratch-like visual blocks
2. **Edit Visually**: Add, remove, and drag-and-drop code blocks in a visual editor
3. **Generate Code**: Convert visual block arrangements back into syntactically correct, properly indented Python code

### 1.2 Target Users

- **Primary**: Developers learning Python who benefit from visual representation
- **Secondary**: Experienced developers who want a quick overview of code structure
- **Tertiary**: Educators teaching Python programming

### 1.3 Design Philosophy

- **Non-Intrusive**: The extension supplements, never replaces, the standard coding workflow
- **Bidirectional Fidelity**: Code → Blocks → Code should produce semantically equivalent output
- **Performance First**: Real-time sync without lag on files up to 1000 lines
- **VS Code Native**: Feels like a natural part of VS Code, not a foreign plugin

---

## 2. Core Concepts & Terminology

| Term | Definition |
|------|------------|
| **Block** | A visual representation of a Python code construct (statement, expression, or compound statement) |
| **Block Canvas** | The visual editor panel where blocks are displayed and manipulated |
| **Block Palette** | A sidebar containing available block types that users can drag into the canvas |
| **AST** | Abstract Syntax Tree - the parsed representation of Python code |
| **Code-Block Mapping** | Bidirectional reference maintaining sync between source code positions and visual blocks |
| **Nesting Zone** | Visual drop area within compound blocks (if/for/while/def/class) where child blocks belong |
| **Sync Mode** | Configuration for when code ↔ block synchronization occurs (manual, on-save, real-time) |

---

## 3. Feature Requirements

### 3.1 Core Features (MVP)

#### F1: Python to Blocks Conversion
- **F1.1**: Parse Python files using AST parsing
- **F1.2**: Generate visual blocks for all supported Python constructs
- **F1.3**: Preserve comments and attach them to relevant blocks
- **F1.4**: Handle multi-line strings and expressions correctly
- **F1.5**: Display syntax errors gracefully with error indicator blocks

#### F2: Block to Python Conversion
- **F2.1**: Generate syntactically valid Python code from block arrangements
- **F2.2**: Maintain proper indentation (4 spaces per level, configurable)
- **F2.3**: Preserve original formatting preferences where possible
- **F2.4**: Insert appropriate blank lines between logical sections

#### F3: Block Manipulation
- **F3.1**: Drag blocks to reorder within the same nesting level
- **F3.2**: Drag blocks into/out of compound statement nesting zones
- **F3.3**: Add new blocks from the block palette
- **F3.4**: Delete blocks (with confirmation for compound blocks)
- **F3.5**: Duplicate blocks (Ctrl+D on selected block)
- **F3.6**: Multi-select blocks (Shift+Click, Ctrl+Click)
- **F3.7**: Cut/Copy/Paste blocks (standard keyboard shortcuts)

#### F4: Block Editing
- **F4.1**: Double-click to edit block content inline
- **F4.2**: Inline editing with syntax highlighting
- **F4.3**: Auto-completion within inline edit fields
- **F4.4**: Escape to cancel, Enter to confirm edits

#### F5: Synchronization
- **F5.1**: Manual sync via command/button
- **F5.2**: Auto-sync on file save
- **F5.3**: Real-time sync mode (configurable, off by default)
- **F5.4**: Conflict resolution UI when both views have unsaved changes

### 3.2 Enhanced Features (Post-MVP)

- **E1**: Block search and filtering
- **E2**: Block folding/collapsing for compound statements
- **E3**: Mini-map for large block canvases
- **E4**: Block templates (custom reusable patterns)
- **E5**: Undo/Redo with visual diff preview
- **E6**: Export block canvas as image/SVG
- **E7**: Keyboard-only block navigation mode

---

## 4. Technical Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          VS Code Extension Host                      │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   Extension     │    │   Python Parser │    │   Block-Code    │  │
│  │   Controller    │◄──►│   Service       │◄──►│   Mapper        │  │
│  └────────┬────────┘    └─────────────────┘    └─────────────────┘  │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Webview Provider                              ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  ││
│  │  │  Message    │  │  State      │  │  Webview Content        │  ││
│  │  │  Broker     │◄►│  Serializer │◄►│  (HTML/CSS/JS)          │  ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          Webview (Block Canvas)                      │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   Block         │    │   Drag-Drop     │    │   Block         │  │
│  │   Renderer      │◄──►│   Engine        │◄──►│   Palette       │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Canvas State Manager                          ││
│  │  (Block Tree, Selection, History, Viewport)                      ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Extension | TypeScript | VS Code native, type safety |
| Python Parsing | Python subprocess OR tree-sitter-python | Accurate Python AST |
| Webview UI | TypeScript + Vanilla CSS | Maximum control, no framework overhead |
| Drag-Drop | Custom implementation | Full control over behavior |
| State Management | Custom reactive store | Lightweight, predictable |
| Code Generation | Custom TypeScript module | Fine control over formatting |

### 4.3 Component Breakdown

#### 4.3.1 Extension Controller (`src/extension.ts`)
- Registers commands, webview provider, and event handlers
- Manages extension lifecycle
- Coordinates between editor and webview

#### 4.3.2 Python Parser Service (`src/parser/`)
- **Strategy A (Recommended)**: Use Python subprocess to run a bundled Python script that outputs JSON AST
- **Strategy B (Alternative)**: Use `tree-sitter-python` WASM binding for in-process parsing
- Returns normalized AST with location information

#### 4.3.3 Block-Code Mapper (`src/mapper/`)
- Maintains bidirectional mapping between AST nodes and Block IDs
- Handles incremental updates
- Provides utilities for position translation

#### 4.3.4 Webview Provider (`src/webview/`)
- Creates and manages the webview panel
- Handles message passing between extension and webview
- Serializes/deserializes webview state

#### 4.3.5 Block Renderer (`webview/src/renderer/`)
- Renders block tree to DOM
- Handles visual updates efficiently (virtual DOM diffing)
- Manages block styling and themes

#### 4.3.6 Drag-Drop Engine (`webview/src/dragdrop/`)
- Handles all drag-drop interactions
- Computes valid drop zones
- Provides visual feedback during drag

#### 4.3.7 Block Palette (`webview/src/palette/`)
- Displays available block types
- Supports search/filter
- Handles drag initiation for new blocks

#### 4.3.8 Canvas State Manager (`webview/src/state/`)
- Maintains the block tree structure
- Manages selection state
- Implements undo/redo stack

---

## 5. Python Parsing Strategy

### 5.1 Parsing Approach

**Recommended**: Python subprocess with bundled script

```
Extension                    Python Subprocess
    │                              │
    │──── Parse Request ──────────►│
    │     (source code)            │
    │                              │ ast.parse()
    │                              │ ast.walk()
    │◄─── JSON AST ───────────────│
    │     (normalized)             │
```

**Bundled Python Script** (`resources/parser.py`):
- Uses Python's built-in `ast` module
- Outputs standardized JSON with node types, positions, and content
- Handles encoding, comments extraction, and error recovery

### 5.2 Supported Python Constructs

#### 5.2.1 Statements (Block-Level)

| Python Construct | Block Type | Block Category |
|------------------|------------|----------------|
| `import x` | Import Block | Imports |
| `from x import y` | FromImport Block | Imports |
| `x = value` | Assignment Block | Variables |
| `x += value` | AugAssign Block | Variables |
| `x: type = value` | AnnotatedAssign Block | Variables |
| `def fn():` | Function Block (compound) | Functions |
| `async def fn():` | AsyncFunction Block | Functions |
| `return value` | Return Block | Functions |
| `yield value` | Yield Block | Functions |
| `class Name:` | Class Block (compound) | Classes |
| `if cond:` | If Block (compound) | Control Flow |
| `elif cond:` | Elif Block (attachment) | Control Flow |
| `else:` | Else Block (attachment) | Control Flow |
| `for x in iter:` | For Block (compound) | Loops |
| `while cond:` | While Block (compound) | Loops |
| `break` | Break Block | Loops |
| `continue` | Continue Block | Loops |
| `try:` | Try Block (compound) | Exceptions |
| `except:` | Except Block (attachment) | Exceptions |
| `finally:` | Finally Block (attachment) | Exceptions |
| `raise exc` | Raise Block | Exceptions |
| `with ctx:` | With Block (compound) | Context |
| `assert cond` | Assert Block | Debug |
| `pass` | Pass Block | Misc |
| `# comment` | Comment Block | Misc |
| `expression` | Expression Block | Misc |

#### 5.2.2 Expressions (Inline within blocks)

Expressions are NOT rendered as separate blocks but displayed as editable text within their parent block:
- Binary operations (`a + b`)
- Comparisons (`a < b`)
- Boolean operations (`a and b`)
- Function calls (`fn(args)`)
- Subscripts (`arr[i]`)
- Attributes (`obj.attr`)
- Literals (strings, numbers, etc.)
- Comprehensions (list, dict, set, generator)
- Lambda expressions
- Ternary expressions (`x if cond else y`)

### 5.3 Comment Handling

Comments are not part of Python's AST. Strategy for extraction:

1. **Pre-parse**: Scan source with regex to extract comment positions
2. **Associate**: Attach comments to the nearest following AST node
3. **Trailing**: Detect inline comments on the same line as code
4. **Standalone**: Create Comment blocks for comment-only lines

### 5.4 Error Recovery

When parsing fails:
1. Attempt line-by-line parsing to isolate error location
2. Create Error Block at the error location
3. Successfully parsed sections still render as normal blocks
4. Error Block shows the problematic code with error message

---

## 6. Block System Design

### 6.1 Block Data Structure

```typescript
interface Block {
  id: string;                    // Unique identifier (UUID)
  type: BlockType;               // Enum of all block types
  content: BlockContent;         // Type-specific content
  children?: Block[];            // For compound blocks
  attachments?: Block[];         // For elif/else/except/finally
  metadata: BlockMetadata;
}

interface BlockContent {
  raw: string;                   // Original source text
  editable: EditableField[];     // Editable portions
}

interface EditableField {
  id: string;
  label: string;                 // e.g., "condition", "target", "value"
  value: string;
  validation?: ValidationRule;
}

interface BlockMetadata {
  sourceRange: Range;            // Original position in source
  comments: Comment[];           // Associated comments
  collapsed: boolean;            // For compound blocks
  error?: string;                // If block has validation error
}

type BlockType = 
  | 'import' | 'fromImport'
  | 'assign' | 'augAssign' | 'annotatedAssign'
  | 'function' | 'asyncFunction' | 'return' | 'yield'
  | 'class'
  | 'if' | 'elif' | 'else'
  | 'for' | 'while' | 'break' | 'continue'
  | 'try' | 'except' | 'finally' | 'raise'
  | 'with'
  | 'assert' | 'pass'
  | 'comment' | 'expression'
  | 'error';
```

### 6.2 Block Visual Design

#### 6.2.1 Block Shape Language

- **Statement Blocks**: Rectangle with slight rounding (8px)
- **Compound Blocks**: C-shaped with nesting indentation
- **Attachment Blocks**: Connect visually to parent compound
- **Expression Inline**: No separate shape, flows within parent

#### 6.2.2 Color Scheme (Default Theme)

| Category | Primary Color | Accent Color |
|----------|--------------|--------------|
| Imports | `#6B7280` (Gray) | `#9CA3AF` |
| Variables | `#8B5CF6` (Purple) | `#A78BFA` |
| Functions | `#3B82F6` (Blue) | `#60A5FA` |
| Classes | `#EC4899` (Pink) | `#F472B6` |
| Control Flow | `#F59E0B` (Amber) | `#FBBF24` |
| Loops | `#10B981` (Emerald) | `#34D399` |
| Exceptions | `#EF4444` (Red) | `#F87171` |
| Context | `#06B6D4` (Cyan) | `#22D3EE` |
| Misc | `#6B7280` (Gray) | `#9CA3AF` |

#### 6.2.3 Block Dimensions

```css
:root {
  --block-min-height: 40px;
  --block-padding-x: 16px;
  --block-padding-y: 8px;
  --block-margin-y: 4px;
  --block-border-radius: 8px;
  --nesting-indent: 24px;
  --connector-width: 4px;
}
```

#### 6.2.4 Visual States

| State | Visual Treatment |
|-------|------------------|
| Default | Standard block appearance |
| Hover | Slight brightness increase, subtle shadow |
| Selected | Bright border, elevated shadow |
| Dragging | Reduced opacity (0.8), larger shadow |
| Drop Target | Glowing indicator line |
| Error | Red border, error icon |
| Collapsed | Shortened height, expand indicator |

### 6.3 Block Anatomy

```
┌────────────────────────────────────────────────────────────┐
│ [Icon] [Block Label]                            [Actions] ?│
│ ──────────────────────────────────────────────────────────│
│ editable_field_1: [                                      ] │
│ editable_field_2: [                                      ] │
│ ┌────────────────────────────────────────────────────────┐ │
│ │              NESTING ZONE (compound only)              │ │
│ │   ┌──────────────────────────────────────────────────┐ │ │
│ │   │ Child Block                                      │ │ │
│ │   └──────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
  ▼ (attachment connector for elif/else/except/finally)
┌────────────────────────────────────────────────────────────┐
│ Attachment Block                                           │
└────────────────────────────────────────────────────────────┘
```

---

## 7. User Interface Specification

### 7.1 Extension Activation

The extension activates when:
- A Python file (`.py`) is opened
- User runs command `VisualPy: Open Block Editor`
- User clicks the VisualPy icon in the editor title bar

### 7.2 Panel Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Sync ↻] [Mode: ▾] [Zoom: 100%] [≡ Layout]      VisualPy     [×]   │
├────────────────┬────────────────────────────────────────────────────┤
│                │                                                    │
│  BLOCK PALETTE │                 BLOCK CANVAS                       │
│  ────────────  │                                                    │
│  [🔍 Search]   │  ┌────────────────────────────────────────────┐   │
│                │  │ import block                                │   │
│  ▼ Imports     │  └────────────────────────────────────────────┘   │
│    ├ import    │  ┌────────────────────────────────────────────┐   │
│    └ from      │  │ def function():                            │   │
│                │  │   ┌────────────────────────────────────┐   │   │
│  ▼ Variables   │  │   │ statement                          │   │   │
│    ├ assign    │  │   └────────────────────────────────────┘   │   │
│    ├ aug-assign│  └────────────────────────────────────────────┘   │
│    └ annotated │                                                    │
│                │  ┌────────────────────────────────────────────┐   │
│  ▼ Functions   │  │ if condition:                              │   │
│    ├ def       │  │   ┌────────────────────────────────────┐   │   │
│    ├ async def │  │   │ ...                                │   │   │
│    ├ return    │  │   └────────────────────────────────────┘   │   │
│    └ yield     │  │ ┌──────────────────────────────────────┐   │   │
│                │  │ │ else:                                │   │   │
│  ▼ Control Flow│  │ │   ┌────────────────────────────────┐ │   │   │
│  ▼ Loops       │  │ │   │ ...                            │ │   │   │
│  ▼ Exceptions  │  │ └───┴────────────────────────────────┘─┘   │   │
│  ▼ Other       │  └────────────────────────────────────────────┘   │
│                │                                                    │
└────────────────┴────────────────────────────────────────────────────┘
```

### 7.3 Toolbar Actions

| Button | Action | Keyboard Shortcut |
|--------|--------|-------------------|
| Sync | Sync code ↔ blocks | `Ctrl+Shift+S` |
| Mode | Toggle sync mode (Manual/OnSave/Realtime) | - |
| Zoom | Adjust canvas zoom (50%-200%) | `Ctrl+Scroll` |
| Layout | Toggle palette visibility, position | - |
| Close | Close block editor panel | `Ctrl+W` |

### 7.4 Block Palette

- **Collapsible categories** for organization
- **Search** filters blocks by name/keyword
- **Drag to canvas** to add new block
- **Double-click** inserts at cursor/selection
- **Tooltips** show block description and Python syntax

### 7.5 Block Canvas

- **Infinite scroll** canvas (virtualized for performance)
- **Zoom and pan** with mouse/trackpad
- **Grid snapping** (optional, configurable)
- **Mini-map** (bottom-right, togglable)
- **Drop indicators** show valid insertion points
- **Context menu** on right-click

### 7.6 Context Menu Options

| On Block | Options |
|----------|---------|
| Any Block | Cut, Copy, Paste, Duplicate, Delete |
| Compound Block | Collapse/Expand, Add Child Block |
| If Block | Add Elif, Add Else |
| Try Block | Add Except, Add Finally |
| Function Block | Add Parameter, Add Decorator |
| Any Editable | Edit, Reset to Default |

### 7.7 Visual Feedback

- **Drag preview**: Ghost block follows cursor
- **Drop zones**: Highlighted lines between blocks
- **Invalid drop**: Red indicator, cursor changes
- **Sync status**: Icon shows synced/pending/error
- **Unsaved changes**: Dot indicator on tab title

### 7.8 Themes

The extension respects VS Code's active theme and provides:
- **Automatic theme detection** (dark/light)
- **Color mappings** for each block category
- **High contrast mode** support
- **Custom theme override** in settings

---

## 8. State Management & Synchronization

### 8.1 State Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Editor State (VS Code)                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ document.getText()        document.uri                  ││
│  │ document.version          document.isDirty              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Sync Events
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Synchronization Service                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ codeToBlocks(source) → BlockTree                        ││
│  │ blocksToCode(tree) → string                             ││
│  │ diffBlocks(old, new) → ChangeSet                        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Messages
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Canvas State (Webview)                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ blockTree: Block[]        selection: Set<BlockId>       ││
│  │ clipboard: Block[]        history: HistoryStack         ││
│  │ viewport: Viewport        dragState: DragState          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Synchronization Modes

#### 8.2.1 Manual Sync
- User explicitly triggers sync via button/command
- Changes in one view do not affect the other until sync
- Warning shown if both views have changes

#### 8.2.2 On-Save Sync (Default)
- Code → Blocks: On file save
- Blocks → Code: Applies to editor and saves file
- Debounced to prevent rapid updates

#### 8.2.3 Real-Time Sync
- Code changes reflect in blocks after 500ms debounce
- Block changes reflect in code immediately
- Higher CPU usage, opt-in only

### 8.3 Conflict Resolution

When both views have unsaved changes:

```
┌──────────────────────────────────────────────────┐
│     ⚠ Sync Conflict Detected                     │
│──────────────────────────────────────────────────│
│ Both the code editor and block canvas have       │
│ unsaved changes. How would you like to proceed?  │
│                                                  │
│  [Use Code]  [Use Blocks]  [Manual Merge]        │
│                                                  │
│  ☐ Remember my choice for this session          │
└──────────────────────────────────────────────────┘
```

### 8.4 Undo/Redo

- **Unified history** across both views
- **Granular actions**: Each block edit is one undo step
- **Batch actions**: Multi-block moves are one step
- **History limit**: 100 actions (configurable)

---

## 9. VS Code Integration

### 9.1 Commands

| Command ID | Title | Description |
|------------|-------|-------------|
| `visualpy.openBlockEditor` | Open Block Editor | Opens block canvas for current Python file |
| `visualpy.syncCodeToBlocks` | Sync: Code → Blocks | Updates blocks from current code |
| `visualpy.syncBlocksToCode` | Sync: Blocks → Code | Updates code from current blocks |
| `visualpy.togglePalette` | Toggle Block Palette | Shows/hides the block palette |
| `visualpy.exportCanvas` | Export Canvas as Image | Exports current canvas as PNG/SVG |

### 9.2 Settings

```jsonc
{
  // Sync mode: "manual" | "onSave" | "realtime"
  "visualpy.syncMode": "onSave",
  
  // Indentation for generated code
  "visualpy.indentSize": 4,
  "visualpy.indentStyle": "spaces", // "spaces" | "tabs"
  
  // Canvas settings
  "visualpy.defaultZoom": 100,
  "visualpy.showMinimap": true,
  "visualpy.gridSnap": false,
  
  // Block palette position
  "visualpy.palettePosition": "left", // "left" | "right" | "hidden"
  
  // Parser configuration
  "visualpy.pythonPath": "", // Auto-detect if empty
  
  // Experimental
  "visualpy.realtimeValidation": false
}
```

### 9.3 Keybindings

| Action | Keybinding | When |
|--------|------------|------|
| Open Block Editor | `Ctrl+Shift+B` | Python file active |
| Sync | `Ctrl+Shift+S` | Block canvas focused |
| Delete Block | `Delete` or `Backspace` | Block selected |
| Duplicate Block | `Ctrl+D` | Block selected |
| Select All | `Ctrl+A` | Canvas focused |
| Undo | `Ctrl+Z` | Canvas focused |
| Redo | `Ctrl+Y` | Canvas focused |
| Zoom In | `Ctrl+=` | Canvas focused |
| Zoom Out | `Ctrl+-` | Canvas focused |
| Reset Zoom | `Ctrl+0` | Canvas focused |

### 9.4 Activation Events

```json
{
  "activationEvents": [
    "onLanguage:python",
    "onCommand:visualpy.openBlockEditor"
  ]
}
```

### 9.5 Fork Compatibility

**VS Code, Cursor, and Antigravity Compatibility**:

The extension uses only standard VS Code APIs:
- `vscode.window.createWebviewPanel`
- `vscode.workspace` APIs
- `vscode.commands` APIs
- Standard webview messaging

**Compatibility verified for**:
- VS Code 1.70+
- Cursor (VS Code fork)
- Google Antigravity (VS Code fork)

**Potential Incompatibilities**:
- Custom Python extensions that modify document handling
- Forks with modified webview security policies

**Mitigation**:
- Use feature detection, not version checking
- Graceful degradation if APIs unavailable
- Document any fork-specific limitations

---

## 10. File Structure & Project Organization

```
VisualPy/
├── .vscode/
│   ├── launch.json              # Debug configurations
│   ├── tasks.json               # Build tasks
│   └── settings.json            # Workspace settings
├── src/
│   ├── extension.ts             # Extension entry point
│   ├── commands/
│   │   ├── index.ts             # Command registration
│   │   ├── openBlockEditor.ts   # Open editor command
│   │   └── sync.ts              # Sync commands
│   ├── parser/
│   │   ├── index.ts             # Parser service
│   │   ├── pythonRunner.ts      # Python subprocess manager
│   │   ├── astNormalizer.ts     # AST normalization
│   │   └── commentExtractor.ts  # Comment handling
│   ├── mapper/
│   │   ├── index.ts             # Block-code mapper
│   │   ├── codeToBlocks.ts      # Code → Block conversion
│   │   └── blocksToCode.ts      # Block → Code generation
│   ├── webview/
│   │   ├── index.ts             # Webview provider
│   │   ├── messageHandler.ts    # Message routing
│   │   └── stateSerializer.ts   # State persistence
│   ├── types/
│   │   ├── blocks.ts            # Block type definitions
│   │   ├── ast.ts               # AST type definitions
│   │   └── messages.ts          # Message type definitions
│   └── utils/
│       ├── config.ts            # Configuration utilities
│       ├── logger.ts            # Logging utilities
│       └── debounce.ts          # Debounce utility
├── webview/
│   ├── src/
│   │   ├── main.ts              # Webview entry point
│   │   ├── canvas/
│   │   │   ├── Canvas.ts        # Canvas component
│   │   │   ├── CanvasRenderer.ts# Render logic
│   │   │   └── Viewport.ts      # Pan/zoom handling
│   │   ├── blocks/
│   │   │   ├── Block.ts         # Base block component
│   │   │   ├── BlockFactory.ts  # Block creation
│   │   │   ├── types/           # Block type implementations
│   │   │   │   ├── ImportBlock.ts
│   │   │   │   ├── AssignBlock.ts
│   │   │   │   ├── FunctionBlock.ts
│   │   │   │   ├── IfBlock.ts
│   │   │   │   └── ...          # Other block types
│   │   │   └── fields/
│   │   │       ├── EditableField.ts
│   │   │       └── FieldValidator.ts
│   │   ├── palette/
│   │   │   ├── Palette.ts       # Palette component
│   │   │   ├── PaletteItem.ts   # Palette block items
│   │   │   └── PaletteSearch.ts # Search functionality
│   │   ├── dragdrop/
│   │   │   ├── DragDropEngine.ts# Drag-drop logic
│   │   │   ├── DropZone.ts      # Drop zone indicators
│   │   │   └── DragPreview.ts   # Drag preview ghost
│   │   ├── state/
│   │   │   ├── CanvasState.ts   # State manager
│   │   │   ├── History.ts       # Undo/redo stack
│   │   │   └── Selection.ts     # Selection management
│   │   ├── ui/
│   │   │   ├── Toolbar.ts       # Toolbar component
│   │   │   ├── ContextMenu.ts   # Context menu
│   │   │   ├── Minimap.ts       # Minimap component
│   │   │   └── Modal.ts         # Modal dialogs
│   │   ├── theme/
│   │   │   ├── ThemeProvider.ts # Theme detection
│   │   │   └── colors.ts        # Color definitions
│   │   ├── messaging/
│   │   │   └── MessageBroker.ts # VS Code messaging
│   │   └── utils/
│   │       ├── dom.ts           # DOM utilities
│   │       └── geometry.ts      # Geometry calculations
│   ├── styles/
│   │   ├── main.css             # Main stylesheet
│   │   ├── blocks.css           # Block styles
│   │   ├── palette.css          # Palette styles
│   │   ├── canvas.css           # Canvas styles
│   │   └── themes/
│   │       ├── dark.css         # Dark theme overrides
│   │       └── light.css        # Light theme overrides
│   └── index.html               # Webview HTML template
├── resources/
│   ├── parser.py                # Python AST parser script
│   ├── icons/
│   │   ├── extension.svg        # Extension icon
│   │   └── blocks/              # Block type icons
│   └── examples/                # Example Python files
├── test/
│   ├── unit/
│   │   ├── parser.test.ts       # Parser tests
│   │   ├── mapper.test.ts       # Mapper tests
│   │   └── codeGen.test.ts      # Code generation tests
│   ├── integration/
│   │   ├── sync.test.ts         # Sync tests
│   │   └── dragdrop.test.ts     # Drag-drop tests
│   └── fixtures/                # Test Python files
├── docs/
│   ├── CONTRIBUTING.md          # Contribution guide
│   ├── ARCHITECTURE.md          # Architecture deep-dive
│   └── CHANGELOG.md             # Version history
├── SPECIFICATION.md             # This document
├── package.json                 # Extension manifest
├── tsconfig.json                # TypeScript config
├── webpack.config.js            # Webpack config
├── .eslintrc.js                 # ESLint config
├── .prettierrc                  # Prettier config
├── .gitignore                   # Git ignore rules
└── README.md                    # User-facing documentation
```

---

## 11. Development Phases

### Phase 1: Foundation (Weeks 1-2)

**Objective**: Basic extension structure and Python parsing

- [ ] Initialize VS Code extension with TypeScript
- [ ] Create extension activation and command registration
- [ ] Implement Python parser subprocess
- [ ] Create AST normalization layer
- [ ] Create basic webview panel
- [ ] Establish message passing between extension and webview

**Deliverable**: Extension that parses Python and logs normalized AST

### Phase 2: Block Rendering (Weeks 3-4)

**Objective**: Visual block representation

- [ ] Define block data structures
- [ ] Implement block factory for all Python constructs
- [ ] Create block renderer with proper styling
- [ ] Implement compound block nesting
- [ ] Add theme support (dark/light)
- [ ] Create block palette structure

**Deliverable**: Static visualization of Python code as blocks

### Phase 3: Block Interaction (Weeks 5-6)

**Objective**: Block manipulation capabilities

- [ ] Implement block selection (single, multi)
- [ ] Implement drag-drop engine
- [ ] Create drop zone logic
- [ ] Add inline editing for block fields
- [ ] Implement cut/copy/paste
- [ ] Add delete and duplicate

**Deliverable**: Fully interactive block canvas

### Phase 4: Code Generation (Week 7)

**Objective**: Blocks to Python conversion

- [ ] Implement code generator
- [ ] Handle indentation correctly
- [ ] Preserve comments
- [ ] Handle edge cases (empty blocks, malformed structures)

**Deliverable**: Round-trip code → blocks → code works correctly

### Phase 5: Synchronization (Week 8)

**Objective**: Bidirectional sync between code and blocks

- [ ] Implement sync modes (manual, on-save, realtime)
- [ ] Create change detection
- [ ] Build conflict resolution UI
- [ ] Implement undo/redo system

**Deliverable**: Code and blocks stay synchronized

### Phase 6: Polish & UX (Weeks 9-10)

**Objective**: Production-ready user experience

- [ ] Minimap implementation
- [ ] Zoom and pan smoothness
- [ ] Keyboard navigation
- [ ] Accessibility improvements
- [ ] Context menus
- [ ] Tooltips and help

**Deliverable**: Polished, intuitive user interface

### Phase 7: Testing & Documentation (Week 11)

**Objective**: Quality assurance and documentation

- [ ] Unit tests for parser and code generator
- [ ] Integration tests for sync
- [ ] End-to-end tests with example files
- [ ] User documentation (README)
- [ ] API documentation

**Deliverable**: Fully tested and documented extension

### Phase 8: Release Preparation (Week 12)

**Objective**: Marketplace-ready release

- [ ] Performance optimization
- [ ] Bundle size optimization
- [ ] Extension icon and branding
- [ ] Marketplace listing
- [ ] Demo video/GIFs

**Deliverable**: Published VS Code extension

---

## 12. Testing Strategy

### 12.1 Unit Tests

**Scope**: Individual functions and modules in isolation

**Tools**: Jest or Mocha with TypeScript

**Coverage Areas**:
- Python parser output normalization
- Block data structure manipulation
- Code generation from blocks
- Comment association logic
- State management operations

**Example Test Cases**:
```typescript
describe('Parser', () => {
  it('parses simple assignment', () => {
    const ast = parse('x = 5');
    expect(ast.body[0].type).toBe('Assign');
  });
  
  it('handles syntax errors gracefully', () => {
    const ast = parse('def incomplete(');
    expect(ast.errors).toHaveLength(1);
  });
});

describe('CodeGenerator', () => {
  it('generates correct indentation', () => {
    const blocks = [/* if block with children */];
    const code = generateCode(blocks);
    expect(code).toContain('    pass');  // 4 spaces
  });
});
```

### 12.2 Integration Tests

**Scope**: Component interactions

**Tools**: VS Code Extension Testing APIs

**Coverage Areas**:
- Extension activation
- Webview creation and messaging
- Sync operations between editor and canvas
- Command execution

### 12.3 End-to-End Tests

**Scope**: Full user workflows

**Tools**: VS Code Extension Testing with Playwright or similar

**Test Scenarios**:
1. Open Python file → Verify blocks render
2. Drag block to new position → Verify code updates
3. Edit code in editor → Verify blocks update
4. Add block from palette → Verify code generated
5. Handle syntax error → Verify error block appears

### 12.4 Manual Testing Checklist

- [ ] Test with Python 3.8, 3.9, 3.10, 3.11 syntax features
- [ ] Test with files of varying sizes (10, 100, 1000 lines)
- [ ] Test dark and light themes
- [ ] Test on Windows, macOS, Linux
- [ ] Test with VS Code, Cursor, and Antigravity
- [ ] Test keyboard-only navigation
- [ ] Test with screen reader

---

## 13. Performance Considerations

### 13.1 Targets

| Metric | Target |
|--------|--------|
| Initial parse (1000 lines) | < 500ms |
| Block render (100 blocks) | < 100ms |
| Sync update | < 200ms |
| Drag-drop feedback | < 16ms (60fps) |
| Memory usage | < 50MB additional |

### 13.2 Optimization Strategies

1. **Virtualized Rendering**: Only render visible blocks
2. **Debounced Sync**: Avoid parsing on every keystroke
3. **Incremental Updates**: Update only changed blocks
4. **Web Workers**: Offload parsing to worker thread
5. **Lazy Loading**: Load block types on demand
6. **Object Pooling**: Reuse DOM elements and objects

### 13.3 Performance Monitoring

- Measure and log parse times
- Track render frame times
- Monitor memory usage
- Profile hot paths

---

## 14. Accessibility

### 14.1 Requirements

- **WCAG 2.1 AA compliance**
- **Keyboard navigation**: All actions accessible via keyboard
- **Screen reader support**: Proper ARIA labels and roles
- **High contrast mode**: Visible in VS Code high contrast themes
- **Focus management**: Clear focus indicators
- **Reduced motion**: Respect `prefers-reduced-motion`

### 14.2 Implementation

```html
<!-- Block accessibility example -->
<div 
  role="treeitem"
  aria-label="If block: x greater than 5"
  aria-expanded="true"
  aria-level="1"
  tabindex="0">
  ...
</div>
```

### 14.3 Keyboard Navigation

| Key | Action |
|-----|--------|
| Arrow Up/Down | Navigate between blocks |
| Arrow Left/Right | Collapse/expand compound blocks |
| Enter | Edit selected block |
| Space | Toggle selection |
| Tab | Move to next editable field |
| Escape | Cancel edit / clear selection |

---

## 15. Known Limitations & Future Scope

### 15.1 MVP Limitations

1. **Decorators**: Basic support only (shown as annotation)
2. **Type Hints**: Displayed but not editable as blocks
3. **Complex Expressions**: Cannot restructure expression trees visually
4. **Async/Await**: Basic support, not all patterns
5. **Match Statements**: Python 3.10+ feature, deferred
6. **Large Files**: >2000 lines may have reduced performance
7. **Multiple Files**: Single file at a time

### 15.2 Future Enhancements

1. **Full Decorator Support**: Visual decorator editing
2. **Expression Blocks**: Break down complex expressions
3. **Multi-File**: Project-wide block view
4. **Collaborative Editing**: Real-time collaboration
5. **AI Integration**: Suggest block insertions
6. **Template Library**: Community-shared templates
7. **Language Support**: Extend to other languages (JavaScript, etc.)

---

## Appendix A: Python Parser Script

**Location**: `resources/parser.py`

```python
#!/usr/bin/env python3
"""
VisualPy AST Parser
Parses Python source code and outputs a normalized JSON AST.
"""

import ast
import json
import sys
import re
from typing import Any, Dict, List, Optional, Tuple


def extract_comments(source: str) -> List[Dict[str, Any]]:
    """Extract all comments with their line numbers."""
    comments = []
    for i, line in enumerate(source.split('\n'), 1):
        match = re.search(r'#.*$', line)
        if match:
            comments.append({
                'line': i,
                'column': match.start(),
                'text': match.group().lstrip('# '),
                'inline': bool(line[:match.start()].strip())
            })
    return comments


def node_to_dict(node: ast.AST, source_lines: List[str]) -> Dict[str, Any]:
    """Convert AST node to dictionary."""
    result = {
        'type': node.__class__.__name__,
        'lineno': getattr(node, 'lineno', None),
        'col_offset': getattr(node, 'col_offset', None),
        'end_lineno': getattr(node, 'end_lineno', None),
        'end_col_offset': getattr(node, 'end_col_offset', None),
    }
    
    # Extract source text for this node
    if result['lineno'] and result['end_lineno']:
        lines = source_lines[result['lineno']-1:result['end_lineno']]
        if lines:
            if len(lines) == 1:
                result['source'] = lines[0][result['col_offset']:result['end_col_offset']]
            else:
                lines[0] = lines[0][result['col_offset']:]
                lines[-1] = lines[-1][:result['end_col_offset']]
                result['source'] = '\n'.join(lines)
    
    # Process child nodes
    for field, value in ast.iter_fields(node):
        if isinstance(value, list):
            result[field] = [
                node_to_dict(item, source_lines) if isinstance(item, ast.AST) 
                else item
                for item in value
            ]
        elif isinstance(value, ast.AST):
            result[field] = node_to_dict(value, source_lines)
        else:
            result[field] = value
    
    return result


def parse_python(source: str) -> Dict[str, Any]:
    """Parse Python source and return normalized AST."""
    source_lines = source.split('\n')
    comments = extract_comments(source)
    
    try:
        tree = ast.parse(source)
        result = {
            'success': True,
            'ast': node_to_dict(tree, source_lines),
            'comments': comments,
            'errors': []
        }
    except SyntaxError as e:
        result = {
            'success': False,
            'ast': None,
            'comments': comments,
            'errors': [{
                'message': str(e.msg),
                'lineno': e.lineno,
                'col_offset': e.offset,
            }]
        }
    
    return result


if __name__ == '__main__':
    source = sys.stdin.read()
    result = parse_python(source)
    print(json.dumps(result, indent=2))
```

---

## Appendix B: Message Protocol

**Extension ↔ Webview Communication**

```typescript
// Extension to Webview
type ExtensionMessage = 
  | { type: 'INIT'; payload: { blocks: Block[]; theme: Theme } }
  | { type: 'UPDATE_BLOCKS'; payload: { blocks: Block[] } }
  | { type: 'SYNC_STATUS'; payload: { status: 'synced' | 'pending' | 'error' } }
  | { type: 'THEME_CHANGED'; payload: { theme: Theme } }
  | { type: 'CONFIG_CHANGED'; payload: { config: Partial<Config> } };

// Webview to Extension
type WebviewMessage =
  | { type: 'READY' }
  | { type: 'BLOCKS_CHANGED'; payload: { blocks: Block[] } }
  | { type: 'REQUEST_SYNC'; payload: { direction: 'toCode' | 'toBlocks' } }
  | { type: 'BLOCK_SELECTED'; payload: { blockId: string } }
  | { type: 'ERROR'; payload: { message: string } };
```

---

## Appendix C: Block Type Specifications

### C.1 Import Block

```typescript
interface ImportBlock extends Block {
  type: 'import';
  content: {
    raw: string;  // "import os, sys"
    editable: [
      { id: 'modules', label: 'Modules', value: 'os, sys' }
    ];
  };
}
```

**Visual**: `[📦] import [os, sys]`

### C.2 Function Block

```typescript
interface FunctionBlock extends Block {
  type: 'function';
  content: {
    raw: string;
    editable: [
      { id: 'name', label: 'Name', value: 'my_function' },
      { id: 'params', label: 'Parameters', value: 'x, y=10' },
      { id: 'returnType', label: 'Return Type', value: '' }  // Optional
    ];
  };
  children: Block[];  // Function body
  attachments: [];    // Decorators if supported
}
```

**Visual**:
```
┌─────────────────────────────────────────┐
│ [⚡] def [my_function]([x, y=10]):      │
│   ┌─────────────────────────────────────│
│   │ (child blocks...)                   │
│   └─────────────────────────────────────│
└─────────────────────────────────────────┘
```

### C.3 If Block

```typescript
interface IfBlock extends Block {
  type: 'if';
  content: {
    raw: string;
    editable: [
      { id: 'condition', label: 'Condition', value: 'x > 0' }
    ];
  };
  children: Block[];       // If body
  attachments: Block[];    // Elif and Else blocks
}
```

---

## Appendix D: CSS Variables Reference

```css
/* Core dimensions */
--visualpy-block-min-height: 40px;
--visualpy-block-padding: 8px 16px;
--visualpy-block-border-radius: 8px;
--visualpy-block-margin: 4px 0;
--visualpy-nesting-indent: 24px;

/* Colors - mapped from VS Code theme */
--visualpy-bg-primary: var(--vscode-editor-background);
--visualpy-bg-secondary: var(--vscode-sideBar-background);
--visualpy-text-primary: var(--vscode-editor-foreground);
--visualpy-text-secondary: var(--vscode-descriptionForeground);
--visualpy-border: var(--vscode-editorWidget-border);
--visualpy-focus: var(--vscode-focusBorder);

/* Block colors by category */
--visualpy-import-bg: #6B7280;
--visualpy-variable-bg: #8B5CF6;
--visualpy-function-bg: #3B82F6;
--visualpy-class-bg: #EC4899;
--visualpy-control-bg: #F59E0B;
--visualpy-loop-bg: #10B981;
--visualpy-exception-bg: #EF4444;

/* Interaction states */
--visualpy-hover-brightness: 1.1;
--visualpy-selected-shadow: 0 0 0 2px var(--visualpy-focus);
--visualpy-drag-opacity: 0.8;
```

---

**End of Specification**

> This document should be referenced throughout development to ensure consistent implementation. Any deviations or enhancements should be documented in subsequent revisions.