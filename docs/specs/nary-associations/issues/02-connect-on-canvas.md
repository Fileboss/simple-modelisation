---
title: Add a Leg by dragging between an Association and an Entity
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: [1]
---

# Add a Leg on the canvas

Spec: [nary-associations](../spec.md).

## What to build

Connectable handles on the Association node; `mcdKind.connect` adds a Leg for Association↔Entity, an Association for Entity↔Entity, nothing otherwise. Panel and palette hints mention it. Tidy up checked with a ternary.

## Acceptance criteria

- [ ] A ternary made by hand in the Merise Notation, with three Cardinalities editable
- [ ] Association↔Association and anything↔Note do nothing
