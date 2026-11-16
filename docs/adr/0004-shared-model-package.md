---
title: The Project document and SQL modules are a shared workspace package
tags: [adr]
date: 2026-11-16
status: accepted
---

# The Project document and SQL modules are a shared workspace package

The MCP server must apply exactly the operations the app applies (and derive the same MLD and SQL), so the Project document and SQL modules move to `packages/model`, a TypeScript-source workspace package imported by both the app and the server, rather than being duplicated on the server. Its files import each other with `.ts` extensions so Node 26 runs them without a build step.

## Consequences

- Node refuses to strip types under `node_modules`: the package must stay a workspace symlink. The Docker image therefore installs the workspace filtered to the server (`pnpm install --prod --filter @simple-modelisation/server...`) instead of `pnpm deploy`, which would copy it into `node_modules`.
- UI-only modules (Notation, strings, presence) stay in the app.
