---
title: Small-screen layout - full-screen canvas, drawers, one-line header
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: []
---

# Small-screen layout

Spec: [mobile-layout](../spec.md).

## What to build

Under 768 px: the canvas fills the screen below a one-line header (☰ menu with Share/Copy link, Stop sharing, Export and its options, back to Projects; the open Diagram's name as a picker that switches, adds, renames and deletes Diagrams; ↶ ↷). The Palette, the Panel (and NotePanel) and the SQL panel move into bottom drawers opened by floating +, ⚙ (with a dot when something is selected) and SQL (MCDs only) buttons; one drawer at a time. A shared `useMediaQuery` hook; `100dvh`, `viewport-fit=cover`, safe-area insets, 16 px form text. Home and Join pages fit 320 px. Above 768 px nothing changes.

## Acceptance criteria

- [ ] At 375 px the canvas takes the whole width; no horizontal page scroll on Project, Home and Join pages
- [ ] Each drawer opens and closes from its button and its ×; opening one closes the other
- [ ] Every header action and Diagram operation is reachable from ☰ and the picker
- [ ] Focusing a Panel field on iOS does not zoom the page
- [ ] At 1280 px the layout is pixel-for-pixel today's
