---
title: '02: Diagram tabs, canvas, undo/redo and JSON export/import'
tags: [ticket, v1-core]
date: 2026-11-16
status: done
blocked_by: [1]
---

# 02: Diagram tabs, canvas, undo/redo and JSON export/import

Part of [v1-core](../spec.md).

**What to build:** inside a Project, the developer adds a System design diagram or an MCD, renames and deletes it, and switches between Diagrams as tabs, the open one being in the URL. Each Diagram shows an empty React Flow canvas with zoom and pan ([ADR 0002](../../../adr/0002-react-flow-canvas.md)). Undo and redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) cover every Project document operation, so later tickets get them for free. A Project exports to a versioned JSON file and imports back as a new Project.

**Blocked by:** 01

**Status:** done

- [x] Add, rename and delete a Diagram of either kind; tabs switch between them; reloading reopens the same tab.
- [x] The canvas zooms, pans and shows a background grid.
- [x] Undo and redo work on Diagram operations, through the Project document module (Yjs UndoManager).
- [x] Export downloads a JSON file with a format version; import creates a new Project from it and rejects an invalid file with a message.
- [x] Tests: creating each Diagram kind, undo/redo of one operation, export → import round trip.
