---
title: MCDs drawn as SVG in Merise, over MCP, in the app and in the zip
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: [1]
---

# MCDs drawn as SVG in Merise, over MCP, in the app and in the zip

Spec: [mcd-svg](../spec.md).

## What to build

The Merise drawing end to end: an MCD as plain SVG (Entities, Associations, Legs with Cardinalities and R, CIFs, Inheritances, Notes, shadows, stored routes, no Legend), returned by `export_diagram` (alone or among every Diagram), used by the app's SVG and PNG exports of an MCD, and included in the all-diagrams zip. The "not drawn yet" messages go.

## Acceptance criteria

- [ ] The Merise cases of the spec's Testing Decisions pass (model drawing and MCP)
- [ ] Checked by hand: the app's SVG and PNG exports and the zip show the MCD
