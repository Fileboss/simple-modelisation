---
title: '04: MCD with Entities, Associations and Cardinalities'
tags: [ticket, v1-core]
date: 2026-11-16
status: ready-for-agent
blocked_by: [3]
---

# 04: MCD with Entities, Associations and Cardinalities

Part of [v1-core](../spec.md).

**What to build:** on an MCD the developer adds Entities, manages their Attributes (add, rename, reorder, remove) and marks the Identifier. With the Association tool, dragging from one Entity to another (or onto itself) creates a named Association with two 0,n Legs; clicking a Leg's Cardinality cycles 0,1 → 1,1 → 0,n → 1,n. Associations can carry Attributes. The MCD is drawn in Looping's style: yellow Entities with an orange header and an underlined Identifier, cyan rounded Associations, Cardinalities on the Legs. The properties panel from ticket 03 edits the selected Entity, Association or Leg.

**Blocked by:** 03 (reuses the properties panel)

**Status:** ready-for-agent

- [ ] Entities are added, moved, renamed by double-click and deleted.
- [ ] Attributes are added, renamed, reordered and removed in the panel; Identifier Attributes show underlined.
- [ ] The Association tool creates binary and reflexive Associations with two 0,n Legs.
- [ ] Clicking a Cardinality cycles it; the panel can set it directly.
- [ ] Deleting an Entity deletes its Legs and any Association left with fewer than two Legs (a reflexive one goes with its Entity).
- [ ] The rendering matches Looping's colors and shapes.
- [ ] Tests: binary and reflexive Association creation, Cardinality cycling, cascade delete.
