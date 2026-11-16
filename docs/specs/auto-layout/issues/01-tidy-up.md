---
title: '01: Tidy up button and layout_diagram tool'
tags: [ticket, auto-layout]
date: 2026-11-16
status: done
blocked_by: []
---

# 01: Tidy up button and layout_diagram tool

Part of [auto-layout](../spec.md).

**What to build:** a shared layered layout (dagre, left to right) used by a Tidy up button in the canvas controls (measured sizes, one undo step, then fit view) and by the MCP tool `layout_diagram` (estimated sizes).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Layout module with its tests (order, no overlap, Associations between their Entities).
- [x] `arrange` applies positions as one undo step.
- [x] Tidy up button; `layout_diagram` tool with an integration test.
- [x] Verified by hand on the Twitter-like Diagram.
