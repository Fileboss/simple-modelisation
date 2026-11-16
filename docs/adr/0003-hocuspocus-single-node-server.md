---
title: Hocuspocus behind one Node server, SQLite storage
tags: [adr]
date: 2026-11-16
status: accepted
---

# Hocuspocus behind one Node server, SQLite storage

Shared Projects sync through [Hocuspocus](https://tiptap.dev/docs/hocuspocus) rather than the minimal `@y/websocket-server` (still 0.x): it is maintained and has the hooks we need to refuse non-UUID document names, cap document size and limit connections, which an open, account-less server requires. One Node process serves both the static app and the WebSocket, replacing the nginx image of v1, so a deployment is a single container. Documents are stored in SQLite on a volume; PostgreSQL waits for real load.

## Consequences

- The repo becomes a pnpm workspace: the web app stays at the root, the server lives in `server/`.
- Sharing stays opt-in ([ADR 0001](0001-yjs-document-model.md) unchanged): a Local Project never reaches the server.
