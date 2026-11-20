---
title: MCD derivations in the model package
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: []
---

# MCD derivations in the model package

Spec: [mcd-svg](../spec.md).

## What to build

Prefactor, no visible change: the rules that turn a stored MCD into what is drawn move to the model package as pure functions over Diagram nodes and edges and a size function. In UML: a binary Association's place on its line and its association class side, each Leg's peer Cardinality and composition, N-ary Associations, CIF constraints, generalizations. In Merise: CIF links, Inheritance lines. The canvas layouts become thin adapters to them.

## Acceptance criteria

- [ ] The canvas draws MCDs exactly as before, in both Notations
- [ ] The existing notation, CIF and inheritance tests run against the model functions and pass
