---
title: Vertical Tidy up for MCDs
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: [1]
---

# Vertical Tidy up for MCDs

Spec: [tidy-up-rework](../spec.md).

## What to build

An MCD's Tidy up direction (horizontal by default, or vertical) is stored in the Project, set in the MCD's settings, used by the Tidy up button and by `layout_diagram`, which also takes `direction` and refuses `vertical` on a System design diagram.

## Acceptance criteria

- [ ] The direction cases of the spec's Testing Decisions pass (layout, document, MCP)
- [ ] Checked by hand: the setting, shared with a peer, and the Tidy up button
