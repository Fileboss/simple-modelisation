---
title: '01: ELK layout with orthogonal routes'
tags: [ticket, orthogonal-routing]
date: 2026-11-16
status: done
blocked_by: []
---

# 01: ELK layout with orthogonal routes

Part of [orthogonal-routing](../spec.md).

**What to build:** the layout module switches from dagre to ELK layered (orthogonal for System design, polyline for MCDs), loaded on demand; ends attach straight; labels go on the longest segment; Tidy up and `layout_diagram` use it.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] ELK layout with the spec's tests; dagre removed.
- [x] Straight end attachment and longest-segment labels.
- [x] Tidy up (lazy ELK chunk) and `layout_diagram` work.
- [x] Verified by hand on the Twitter-like copy.
