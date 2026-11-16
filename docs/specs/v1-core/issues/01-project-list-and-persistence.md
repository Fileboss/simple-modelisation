---
title: '01: Project list, persistence and Docker image'
tags: [ticket, v1-core]
date: 2026-11-16
status: done
blocked_by: []
---

# 01: Project list, persistence and Docker image

Part of [v1-core](../spec.md).

**What to build:** the home page lists the Projects stored in the browser; the developer creates, renames, deletes and opens a Project, and everything survives a reload. This lays down the Project document module (a Yjs document per Project, [ADR 0001](../../../adr/0001-yjs-document-model.md)) with Vitest wired to `make test`, routing (home, Project by id) and a Docker image serving the static build with nginx.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The home page lists Projects (name, last updated) and creates, renames and deletes them.
- [x] Opening a Project goes to its own route; an unknown id shows a "not found" message with a link home.
- [x] Projects and their documents persist in IndexedDB; deleting a Project removes both.
- [x] Vitest runs through `make test` with a first test on the Project document module.
- [x] A Dockerfile builds the app and serves it with nginx, used by the generated Docker workflow.
- [x] The demo Vite page is gone.
