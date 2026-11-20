---
title: malformed-documents - a malformed entry in a Shared Project no longer breaks the app
tags: [spec]
date: 2026-11-20
status: done
---

# malformed-documents

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Project, Shared Project, Participant, Diagram).

## Problem Statement

A Shared Project is a Yjs document any Participant (or anyone holding its Share link) can write to. Reads trust its shape: a diagram entry that is not a map, an unknown Diagram kind, a node or edge that is a plain value, a name that is not text, or a node stored under a key other than its `id`, and every Participant's app throws, with no error boundary: a blank page, again at every reload, since the entry is kept in IndexedDB, in the Local copy Stop sharing makes, and breaks the JSON export. Over MCP, the same key/`id` mismatch makes writes report success without changing anything.

## Solution

Reads are tolerant: what cannot be read is left out — not drawn, not exported, not seen over MCP — and the rest of the Project works. A discreet banner says how many entries of this Project could not be read. Nothing is deleted or rewritten: an entry written by a newer version of the app stays intact for those who can read it.

- **Diagrams**: an entry is read when it is a map whose `id` is its key, whose kind is known, and whose nodes and edges are maps; a name that is not text reads as the kind's default name, a creation time that is not a number as 0.
- **Nodes and edges**: an entry is read when it is a map whose `id` is its key and that passes the existing checks (as an imported file).
- **Project name**: anything but text reads as no name.
- **Banner**: "N entries of this Project could not be read (written by another version of the app?)." above the tabs, while N > 0. N counts the diagram entries, and the open Diagram's nodes and edges; an edge merely left dangling by concurrent edits is not counted.
- **Error boundary**: should something still throw while drawing, the whole Project page (header included) shows "This Project could not be shown" with a Reload button instead of a blank page.

## Implementation Decisions

- `ProjectDocument`: one check for a diagram entry, used by `diagrams()` and `requireDiagram` (so no write lands on an entry the app cannot read); nodes and edges are read and written through one view that only exposes entries that are maps stored under their own `id`, so no write lands on an entry reads leave out. `unreadable(): number` counts what reads leave out (diagram entries, and nodes and edges of readable diagrams).
- MCP reads go through the same methods: the key/`id` mismatch is left out, so a write can no longer target it.
- A React error boundary around the Project's workspace.
- No change to the format.

## Testing Decisions

- Model: a document with each kind of malformed entry (diagram as a number, unknown kind, nodes not a map, node as a string, node under another key, edge as a number, name as a number) — `diagrams()`, `nodes()`, `edges()`, `toFile()` and `name()` do not throw and leave them out; `unreadable()` counts them; the entries are still in the document.
- MCP: a node stored under another key is not listed and cannot be renamed.
- By hand: write a malformed entry into a Shared Project from a script; the other tab shows the banner and keeps working.

## Out of Scope

Repairing (deleting) unreadable entries; telling Participants which version wrote them.
