---
title: '01: Zones on the canvas'
tags: [ticket, grouping-zones]
date: 2026-11-17
status: done
blocked_by: []
---

# 01: Zones on the canvas

Part of [grouping-zones](../spec.md).

**What to build:** a Zone is dropped from the palette, renamed, resized, moved with its content, nested and deleted; it is stored in the Project and exported in images.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] `zone` nodes in the model: operations, import validation, Connections refused, tests.
- [x] Geometric membership function in the model package, tested.
- [x] Moving both ends of a Connection shifts its route.
- [x] Zone node: under everything, title bar, resizer; dragging moves its members.
- [x] Verified by hand in the browser.
