---
title: '01: Place Connection labels without overlap'
tags: [ticket, label-placement]
date: 2026-11-17
status: done
blocked_by: []
---

# 01: Place Connection labels without overlap

Part of [label-placement](../spec.md).

**What to build:** geometry on plain boxes; a pure placement module choosing each Connection label's position along its route, free of other labels and boxes; the System design drawing step passes the positions to the Connections.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Geometry on boxes, shared by edges and placement.
- [x] Placement module with its tests.
- [x] Labels placed in the canvas; verified on the Twitter-like copy.
