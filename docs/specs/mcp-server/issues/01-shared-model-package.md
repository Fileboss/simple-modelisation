---
title: '01: Shared model package'
tags: [ticket, mcp-server]
date: 2026-11-16
status: done
blocked_by: []
---

# 01: Shared model package

Part of [mcp-server](../spec.md), [ADR 0004](../../../adr/0004-shared-model-package.md).

**What to build:** the Project document (with Data types) and the MLD / PostgreSQL modules move to `packages/model`, a workspace package with `.ts` imports, used by the app and runnable by the server under Node 26 without a build. The Docker image installs the workspace filtered to the server. Behaviour is unchanged.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] `packages/model` holds the Project document, Data types, MLD and PostgreSQL modules and their tests; the app imports them from the package.
- [x] The server can import the package and run under Node 26 directly.
- [x] `make lint test build` and the Docker image work.
