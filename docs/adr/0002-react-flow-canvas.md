---
title: React Flow for every Diagram canvas
tags: [adr]
date: 2026-11-16
status: accepted
---

# React Flow for every Diagram canvas

Both Diagram kinds (System design diagram, MCD) render on React Flow (`@xyflow/react`) with custom React nodes and edges, instead of a hand-written SVG canvas. It gives zoom, pan, selection, dragging and edge routing for free; the cost is that rendering follows React Flow's node/edge model, so the Looping look of the MCD is reproduced with custom nodes rather than a free-form drawing engine.
