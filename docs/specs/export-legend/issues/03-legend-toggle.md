---
title: 03 - Include legend checkbox in the Export menu
tags: [ticket]
date: 2026-11-19
status: done
blocked_by: [1]
---

# 03 - Include legend checkbox in the Export menu

An "Include legend" checkbox in the Export menu, on by default, remembered in this browser (local storage, read and written defensively), passed to "Diagram as PNG", "Diagram as SVG" and the "All diagrams" zip.

## Acceptance criteria

- [x] Unchecked, the three exports have no Legend; checked, they have it
- [x] The choice survives a reload; storage failing falls back to on
- [x] UI string kept with the others
