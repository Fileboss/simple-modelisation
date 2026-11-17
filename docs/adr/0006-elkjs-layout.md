---
title: elkjs replaces dagre for layout
tags: [adr]
date: 2026-11-16
status: accepted
---

# elkjs replaces dagre for layout

Supersedes [ADR 0005](0005-dagre-layout.md). dagre's routes are polylines with diagonals and its crossing reduction left busy System design diagrams hard to read; ELK's layered algorithm routes edges orthogonally and reduces crossings better. Its size (about 1.5 MB minified) is paid only on the first Tidy up: the browser imports it on demand. The stored routes (inner bends as optional `points` on edges) keep ADR 0005's approved format.
