---
title: '03: System design diagram with Components, Connections and Skins'
tags: [ticket, v1-core]
date: 2026-11-16
status: ready-for-agent
blocked_by: [2]
---

# 03: System design diagram with Components, Connections and Skins

Part of [v1-core](../spec.md).

**What to build:** on a System design diagram the developer drags Components from a palette of the seven Component types (Client, Service, Database, Cache, Message queue, Gateway, Object storage), moves, renames (double-click) and deletes them, and joins them with directed, labelled Connections. Selecting an element opens the properties panel (introduced here, reused by the MCD). For a selected Component, the panel shows a grid of Skins for its Component type; clicking one applies the product's logo, color and name, "Generic" clears it.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The palette offers the seven Component types, each with its own generic look.
- [ ] Components move, rename by double-click and delete with the Delete key.
- [ ] Connections are drawn by dragging between Components, show an arrow and an editable label.
- [ ] The properties panel edits the selected Component (label, Skin) or Connection (label).
- [ ] The catalog has about three Skins per Component type with Simple Icons logos (CC0); a skinned Component keeps its own label and shows the product.
- [ ] An unknown Skin id (e.g. from an imported file) renders as Generic.
- [ ] Tests: applying and clearing a Skin; deleting a Component deletes its Connections.
