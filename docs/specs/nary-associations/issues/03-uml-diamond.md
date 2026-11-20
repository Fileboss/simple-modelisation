---
title: N-ary Associations as a UML diamond
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: [1]
---

# UML diamond

Spec: [nary-associations](../spec.md).

## What to build

`umlLayout` leaves an N-ary Association at its stored position, draggable, flagged `umlNary`; each of its Legs shows its own multiplicity. The Association node draws a diamond with the name beside it and an association class (dashed line) when it has Attributes.

## Acceptance criteria

- [ ] Unit test on `umlLayout` for a ternary
- [ ] Switching Notation on a diagram with a binary and a ternary draws both correctly
