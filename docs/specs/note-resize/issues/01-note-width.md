---
title: Note width
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: []
---

# Note width

Spec: [note-resize](../spec.md).

## What to build

The whole item: a Note's stored width, used by every size and drawing, set by its left and right handles on the canvas (snapped, one undo step) and by `set_note` over MCP.

## Acceptance criteria

- [ ] The cases of the spec's Testing Decisions pass
- [ ] Checked by hand: resizing a Note from either side, its text wrapping, an export keeping the width
