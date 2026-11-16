---
title: '02: Cursors and selections'
tags: [ticket, live-presence]
date: 2026-11-16
status: done
blocked_by: [1]
---

# 02: Cursors and selections

Part of [live-presence](../spec.md).

**What to build:** on a Shared Project, each Participant sees the cursors of the others on the same Diagram, with a name tag in their color, in canvas coordinates so they follow zoom and pan; and an outline in their color around the nodes and edges they selected. Cursor updates are throttled to about 20 per second; a cursor disappears when its owner leaves the canvas, is idle 30 s or disconnects.

**Blocked by:** 01

**Status:** done

- [x] Cursors of Participants on the same Diagram show with their name; not those on other Diagrams.
- [x] Cursors stay on the right element while zooming and panning.
- [x] Selected nodes and edges of others are outlined in their color.
- [x] Cursors vanish on leaving the canvas, after 30 s idle, and on disconnect.
- [x] Verified in two headless browsers.
