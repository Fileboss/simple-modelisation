---
title: 01 - Reads ignore malformed elements
tags: [ticket]
date: 2026-11-19
status: done
blocked_by: []
---

# 01 - Reads ignore malformed elements

Node and edge reads keep only elements valid by the import rules, so a peer's malformed field neither crashes canvases and MCP reads nor reaches the SVG export.

## Acceptance criteria

- [x] A string `x` or non-list `attributes` written by a peer: the element is left out of reads
- [x] The SVG export of such a Diagram holds no injected attribute
- [x] Existing documents, imports and pastes read as before
