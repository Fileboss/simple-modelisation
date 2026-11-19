---
title: 02 - PNG of a System design diagram rasterized from its SVG
tags: [ticket]
date: 2026-11-19
status: done
blocked_by: []
---

# 02 - PNG of a System design diagram rasterized from its SVG

"Diagram as PNG" on a System design diagram rasterizes the plain SVG (measured sizes, scale 2 within the canvas limits) instead of capturing the page, so it shows what the SVG shows, Legend included. MCDs keep the page capture.

## Acceptance criteria

- [x] The PNG matches the SVG export of the same Diagram
- [x] A large Diagram still exports (scale lowered within the limits)
- [x] MCD PNG and SVG unchanged
