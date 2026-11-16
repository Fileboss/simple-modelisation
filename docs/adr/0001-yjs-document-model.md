---
title: Projects are Yjs documents from the first version
tags: [adr]
date: 2026-11-16
status: accepted
---

# Projects are Yjs documents from the first version

Real-time collaboration is a core goal but ships after the first version. Retrofitting it onto a plain JSON state would mean rewriting every edit path, so each Project is a Yjs document from day one: the first version persists it locally in the browser (IndexedDB), and a later item adds a sync server and link sharing without changing the data model.

## Considered Options

- Plain React state saved as JSON, collaboration added later: cheapest now, a rewrite later.
- Automerge: comparable CRDT, smaller ecosystem of providers (websocket, IndexedDB) and canvas bindings than Yjs.
