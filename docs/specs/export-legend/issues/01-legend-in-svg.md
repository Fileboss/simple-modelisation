---
title: 01 - Legend in the System design SVG and export_diagram
tags: [ticket]
date: 2026-11-19
status: done
blocked_by: []
---

# 01 - Legend in the System design SVG and export_diagram

The renderer draws the Legend below the content, bottom right, from what it drew (Flows, Provider, Hosting and Runtime badges), behind a `legend` option on by default. The app's "Diagram as SVG" and the zip get it at once; `export_diagram` takes an optional `legend` boolean.

## Acceptance criteria

- [x] Renderer tests from the spec: entries listed only when shown, Zone Providers counted, External's not, Runtime only as a badge, no Legend with nothing to explain or `legend: false`, frame holds it, names escaped
- [x] Section headings come from the names passed in (app strings and English names)
- [x] MCP test: Legend by default, none with `legend: false`
