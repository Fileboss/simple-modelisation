---
title: v1 core - Projects, System design diagrams and MCDs
tags: [spec, v1]
date: 2026-11-16
status: ready-for-agent
---

# v1 core

Vocabulary: [GLOSSARY](../../../GLOSSARY.md). Decisions: [ADR 0001](../../adr/0001-yjs-document-model.md) (Yjs documents), [ADR 0002](../../adr/0002-react-flow-canvas.md) (React Flow).

## Problem Statement

A developer who wants to sketch an architecture or a database model has to pick between heavy generic tools (draw.io, Figma) that know nothing about databases or market products, and desktop Merise tools (Looping) that run only on Windows and do one thing. They want one light web app, made for developers, where a Database box can become PostgreSQL in one click and an MCD looks like Looping's, with real-time collaboration on the roadmap.

## Solution

A static web app. The home page lists the Projects stored in the browser. A Project holds Diagrams shown as tabs, each one either a System design diagram or an MCD:

- **System design diagram**: drag Components from a palette of seven Component types, give a Component a Skin from a grid of market product logos, join Components with labelled Connections.
- **MCD**: Entities with Attributes and an underlined Identifier, binary or reflexive Associations (optionally carrying Attributes), Legs labelled with a Cardinality that cycles on click. Drawn in Looping's style: yellow Entities with an orange header, cyan rounded Associations.

Selecting an element opens a properties panel; double-clicking a name renames it in place. Everything autosaves locally; a Project exports to and imports from a JSON file; undo and redo work everywhere. The UI is in English.

## User Stories

### Projects

1. As a developer, I want a home page listing my Projects, so that I can get back to my work.
2. As a developer, I want to create a Project, so that I can start modeling.
3. As a developer, I want to rename a Project, so that I can tell my Projects apart.
4. As a developer, I want to delete a Project, so that my list stays clean.
5. As a developer, I want my changes saved automatically in the browser, so that a reload or a closed tab loses nothing.
6. As a developer, I want to export a Project to a JSON file, so that I can back it up or move it to another browser.
7. As a developer, I want to import a Project from a JSON file, so that I can restore or receive one.

### Diagrams

8. As a developer, I want to add a System design diagram or an MCD to a Project, so that one Project covers both the architecture and the data model.
9. As a developer, I want the Diagrams of a Project shown as tabs, so that I can switch between them.
10. As a developer, I want to rename and delete a Diagram, so that I can organise the Project.
11. As a developer, I want to zoom, pan and select on the canvas, so that I can work on large Diagrams.
12. As a developer, I want to move elements by dragging them, so that I can lay out the Diagram.
13. As a developer, I want to delete the selected elements with the Delete key, so that I can fix mistakes quickly.
14. As a developer, I want undo and redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z), so that I can experiment safely.
15. As a developer, I want a properties panel for the selected element, so that I can edit its details.
16. As a developer, I want to rename an element by double-clicking its name, so that naming is fast.

### System design

17. As a developer, I want a palette with the Component types Client, Service, Database, Cache, Message queue, Gateway and Object storage, so that I can drag the parts of my system onto the canvas.
18. As a developer, I want each Component type to have its own generic look, so that a Diagram reads without Skins.
19. As a developer, I want to pick a Skin for a Component from a grid of logos for its Component type, so that my Database shows as PostgreSQL in one click.
20. As a developer, I want to go back to the generic look ("Generic"), so that I can undo a Skin choice.
21. As a developer, I want a skinned Component to show the product's logo, color and name, while keeping my own label, so that I see both the role and the product.
22. As a developer, I want to join two Components with a directed Connection, so that I can show how data flows.
23. As a developer, I want to label a Connection (HTTP, gRPC...), so that the protocol is visible.

### MCD

24. As a developer, I want to add an Entity, so that I can model a thing the system records.
25. As a developer, I want to add, rename, reorder and remove the Attributes of an Entity, so that it lists its properties.
26. As a developer, I want to mark Attributes as the Identifier, shown underlined, so that the Entity's key is visible.
27. As a developer, I want to draw an Association by dragging from one Entity to another with the Association tool, so that a named Association with two 0,n Legs appears between them.
28. As a developer, I want to drag from an Entity onto itself, so that I can create a reflexive Association.
29. As a developer, I want to give an Association Attributes, so that I can model data carried by the relationship.
30. As a developer, I want to change a Leg's Cardinality by clicking its label (0,1 → 1,1 → 0,n → 1,n) or from the panel, so that I can set it quickly.
31. As a developer, I want the MCD drawn like Looping (yellow Entities with an orange header, cyan rounded Associations, Cardinalities on the Legs), so that it looks like the Merise diagrams I know.
32. As a developer, I want deleting an Entity to delete its Legs, and an Association left with fewer than two Legs to be deleted too, so that the MCD never holds dangling elements.

## Implementation Decisions

- **Project document module** (the deep module of this item): owns a Project as a Yjs document and exposes domain operations only: create/rename/delete Diagram; add/move/rename/delete Component, set or clear its Skin, add/label/delete Connection; add/rename/delete Entity, add/rename/reorder/remove Attribute, toggle Identifier; create an Association between two Entities (or one, reflexive) with two 0,n Legs, set a Leg's Cardinality, cycle it; export to and import from JSON. The UI never touches the Yjs structures directly. Undo/redo is a Yjs UndoManager scoped to the document.
- **Document shape** (stored data; changing it later is a migration): a Project holds metadata (name, dates) and a map of Diagrams by id; a Diagram has a kind (`system` or `mcd`), a name and maps of its elements by id with their positions. The exported JSON carries a format version.
- **Project store**: the list of Projects (ids, names, dates) lives in IndexedDB beside each Project's Yjs document (persisted with `y-indexeddb`). Deleting a Project removes both.
- **Canvas**: one React Flow canvas component per Diagram kind, with custom nodes (Component, Entity, Association) and edges (Connection, Leg). React Flow state is derived from the Project document; user gestures call document operations.
- **Catalog**: the Component types and Skins are static data in the app (type, product name, color, logo from Simple Icons, CC0). About three Skins per Component type, e.g. Database: PostgreSQL, MySQL, MongoDB; Cache: Redis, Memcached, Valkey; Message queue: Kafka, RabbitMQ, NATS; Gateway: Nginx, Traefik, Kong; Object storage: S3, MinIO, Cloudflare R2; Service: Node.js, Spring Boot, Go; Client: React, Mobile, Browser. Unknown Skin ids in imported data fall back to Generic.
- **Routing**: a home route (Project list) and a Project route by id, with the open Diagram tab in the URL.
- **Deployment**: the build is static; the Docker image serves it with nginx.
- **UI language**: English, strings kept together so a French translation can be added later.

## Testing Decisions

- One test seam: the **Project document module**. Tests call its domain operations and assert on what it exposes (Diagram contents, exported JSON), never on Yjs internals or React components.
- 80/20: a handful of Vitest tests on the core behaviours: creating each Diagram kind, applying and clearing a Skin, creating a binary and a reflexive Association with 0,n Legs, cycling a Cardinality, cascade delete of an Entity, undo/redo of one operation, JSON export → import round trip. UI and end-to-end tests (Playwright) come in later items.
- No prior art in the repo; Vitest is added by this item and wired to `make test`.

## Out of Scope

In the backlog, in priority order: sync server, link sharing and live cursors; PostgreSQL SQL generation from an MCD; UML Notation for MCDs; an MCP server exposing Diagrams to AI agents; grouping zones in System design diagrams (VPC, region); custom Skins; ternary Associations, inheritance and CIF; French UI; image export (PNG/SVG). Also out: Attribute data types, MLD, accounts and authentication, any server.

## Further Notes

- The MCD look and the Merise vocabulary come from [Rollercoaster](../../../../rollercoaster/README.md) (Looping rewrite), deliberately simplified.
- Local Node should match `.nvmrc` (26).
