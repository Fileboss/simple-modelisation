---
title: MCDs drawn as SVG in UML, with a notation argument over MCP
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: [2]
---

# MCDs drawn as SVG in UML, with a notation argument over MCP

Spec: [mcd-svg](../spec.md).

## What to build

The UML drawing: classes with typed Attributes, binary Associations on their line with their association class, N-ary diamonds with their constraints, multiplicities, compositions, generalizations, Notes. `export_diagram` takes `notation` (`merise` by default, ignored for System design); the app's exports and the zip use the Notation chosen in this browser for each MCD.

## Acceptance criteria

- [ ] The UML cases of the spec's Testing Decisions pass (model drawing and MCP, `notation` ignored on System design)
- [ ] Checked by hand: an MCD shown in UML exports in UML from the app and in the zip
