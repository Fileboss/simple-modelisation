---
title: Big handles and the long-press menu
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: [2]
---

# Big handles and the long-press menu

Spec: [mobile-layout](../spec.md).

## What to build

On a coarse pointer, handles of the selected node (and of nodes while connecting) are 28 px discs with a 44 px hit area. A long-press hook (500 ms, 8 px, one pointer) on nodes, Connections and the pane opens a `ContextMenu`: on an element Properties, Duplicate, Copy, Cut, Delete; on the background Paste here, Select all. Reuse the copy-paste actions; paste at the finger. Prevent the native `contextmenu`, text selection and iOS callout on the canvas. Double tap on an element opens the Panel drawer except where it edits text in place.

## Acceptance criteria

- [ ] A Connection can be drawn between two Components with a finger
- [ ] Each menu entry does what it says, on iOS Safari and Android Chrome, without the browser's own menu
- [ ] Unit tests on the long-press detector (delay, movement, two fingers, early release)
- [ ] Selecting several elements by touch stays in BACKLOG.md
