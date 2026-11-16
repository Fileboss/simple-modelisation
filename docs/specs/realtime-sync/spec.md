---
title: realtime-sync - Shared Projects synced in real time
tags: [spec]
date: 2026-11-16
status: done
---

# realtime-sync

Vocabulary: [GLOSSARY](../../../GLOSSARY.md). Decisions: [ADR 0001](../../adr/0001-yjs-document-model.md) (Yjs documents), [ADR 0003](../../adr/0003-hocuspocus-single-node-server.md) (Hocuspocus, one Node server, SQLite).

## Problem Statement

Every Project lives in one browser. A developer cannot show a Diagram to a colleague, work on it together, or open it on another machine, except by exporting and importing a JSON file, which forks it.

## Solution

A **Share** button turns a Local Project into a Shared Project: it is sent to the sync server and its Share link is copied. Anyone opening the link gets the Project in their home list and edits it with everyone else in real time. A Shared Project is still kept in the browser, so it opens and can be edited offline; changes merge when the connection comes back. The Project header shows whether the Project is Local, Synced or Offline. Projects are never shared unless their owner clicks Share.

## User Stories

1. As a developer, I want a Share button on a Local Project, so that I can work on it with others.
2. As a developer, I want the Share link copied when I share, so that I can paste it to a colleague right away.
3. As a developer, I want to copy the Share link of a Shared Project again later, so that I can invite more people.
4. As a colleague, I want to open a Share link and land in the Project, so that I can see the Diagrams at once.
5. As a colleague, I want a Project I opened by link to appear in my home list, so that I can come back to it.
6. As a developer, I want the changes of everyone on a Shared Project to appear in real time, so that we edit together.
7. As a developer, I want the Project's name shared too, so that everyone sees the same name and a rename reaches everyone.
8. As a developer, I want to keep editing a Shared Project offline and have my changes merged when I reconnect, so that a bad connection loses nothing.
9. As a developer, I want the header to say Local, Synced or Offline, so that I know whether others see my changes.
10. As a developer, I want undo to undo only my own changes, so that I never revert a colleague's work.
11. As a developer, I want removing a Shared Project from my list to leave it intact for the others, so that I cannot destroy their work.
12. As a developer, I want a wrong or unknown Share link to say the Project does not exist, so that I am not left with an empty Project.
13. As a developer, I want my Local Projects never to reach the server, so that what I do not share stays private.
14. As an operator, I want one container serving the app and the sync, with its data on a volume, so that deploying is one command.
15. As an operator, I want the server to refuse malformed document names, oversized documents and connection floods, so that an open server stays usable.

## Implementation Decisions

- **Project name in the document** (data schema change, approved): the name moves into the Project document (a `meta` map); the Project list keeps a cached copy for display and refreshes it from the document. A Project document without a name gets the list's name the first time it is opened (migration). The JSON file format keeps its `name` field; version unchanged.
- **Project list entries** gain a `shared` flag. Removing a Shared Project deletes the local copy and the list entry only. A Shared Project is renamed from inside it, not from the home list, so the rename goes through the sync instead of racing it.
- **Sync server** (`server/` workspace package, Node): Hocuspocus with SQLite persistence, serving the built app with a fallback to `index.html` for client routes, and the WebSocket on `/sync` on the same origin. Guards: document names must be UUIDs; connecting to an unknown document is refused unless the client declares it is sharing it (only the Share button does); creating documents is rate limited per IP (the declaration proves nothing); a document past 5 MB stays readable but takes no more changes, and its clients are told so instead of being disconnected; connections per IP are limited; refusals are logged. The client address is the socket's, or the last `X-Forwarded-For` entry only when `TRUST_PROXY` is set. Configuration through environment variables (port, data directory, static directory, proxy trust) with defaults. The sync path, intents and messages are one protocol module the app imports.
- **Client provider**: a Shared Project opens with both the IndexedDB persistence and a Hocuspocus provider on the same Yjs document. The sync status (Local, Synced, Offline, and Full when the server reached the size limit) comes from the provider's connection and sync state. The "last updated" date moves only with this user's own edits. Undo stays scoped to local changes.
- **Routes**: `/s/<id>` opens a Share link: it checks the Project exists on the server, adds it to the list as shared, then goes to `/p/<id>`. The Share link is built from the page's origin.
- **Deployment**: the Docker image runs the Node server instead of nginx; a `docker-compose.yml` example mounts the SQLite volume. Vite proxies `/sync` to a local server in development.
- **Workspace**: pnpm workspace with the root app and `server/`; `make lint test build` cover both.

## Testing Decisions

- Tests check external behaviour only: what a client sees in its Yjs document, what the server accepts or refuses, what the Project document exposes.
- **Server integration tests**: start the server in-process on a free port with a temporary data directory, connect real Yjs clients. Cases: an edit from one client reaches the other; a non-UUID name is refused; joining an unknown document is refused and creates nothing; sharing creates it; an oversized document is refused; a document survives a server restart.
- **Project document tests**: the name lives in the document, a rename is visible through it, the migration fills a missing name.
- Prior art: the Vitest tests on the Project document module.

## Out of Scope

Live presence and cursors (next item); stopping sharing; read-only links; accounts and authentication; end-to-end encryption; deleting a Shared Project on the server; choosing a hosting provider.
