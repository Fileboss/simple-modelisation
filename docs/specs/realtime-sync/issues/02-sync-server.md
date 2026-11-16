---
title: '02: Sync server with SQLite and guards'
tags: [ticket, realtime-sync]
date: 2026-11-16
status: done
blocked_by: []
---

# 02: Sync server with SQLite and guards

Part of [realtime-sync](../spec.md), [ADR 0003](../../../adr/0003-hocuspocus-single-node-server.md).

**What to build:** a `server/` workspace package: one Node process serving the built app (fallback to `index.html` for client routes) and Hocuspocus on `/sync`, storing documents in SQLite. It refuses non-UUID document names, refuses to open an unknown document unless the client declares it is sharing it, refuses documents above 5 MB, limits connections per IP and logs refusals. The Docker image runs this server instead of nginx; a `docker-compose.yml` example mounts the data volume. Vite proxies `/sync` in development.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The repo is a pnpm workspace; `make lint test build` cover the root app and `server/`.
- [x] The server serves the app and client routes, and syncs documents on `/sync`.
- [x] Guards: UUID names, no creation on join, 5 MB cap, per-IP connection limit, refusals logged.
- [x] Port and data directory come from environment variables with defaults.
- [x] The Docker image builds and runs the server; `docker-compose.yml` keeps data on a volume.
- [x] Integration tests with real Yjs clients: edits sync between two clients; non-UUID refused; unknown join refused and nothing created; share creates; oversized refused; a document survives a restart.
