---
title: dagre lays Diagrams out, in the shared model package
tags: [adr]
date: 2026-11-16
status: superseded by ADR 0006
---

# dagre lays Diagrams out, in the shared model package

Tidy up and the MCP tool `layout_diagram` arrange a Diagram in layers along its links with dagre (`@dagrejs/dagre`), a runtime dependency of `packages/model` so the browser and the server compute the same layout. elkjs lays out better (orthogonal edges, ports) but is about six times larger and asynchronous; a few dozen elements do not need it.

## Consequences

- Inputs are sorted by id before layout, so every peer computes the same positions.
- A Tidy up stores dagre's inner bends as optional `points` on Connections and Legs (data schema change approved by the user on 2026-11-16); the ends attach to the boxes as drawn, and moving an end drops the route.
