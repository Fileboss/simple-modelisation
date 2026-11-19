---
title: 02 - Minimal pinned image, HEALTHCHECK, hardened compose
tags: [ticket]
date: 2026-11-19
status: done
blocked_by: [1]
---

# 02 - Minimal pinned image, HEALTHCHECK, hardened compose

Both stages on `node:26-alpine` pinned by digest; production dependencies installed in a `deps` stage and copied; npm, corepack and yarn removed from the runtime; `HEALTHCHECK` through `node` on `/health`. The public compose drops capabilities and bounds memory and processes; the stored one drops capabilities too.

## Acceptance criteria

- [x] `docker build` succeeds; `npm`, `npx`, `corepack`, `pnpm`, `yarn` absent from the runtime
- [x] The container reaches `healthy`; the app opens and shares a Project
- [x] `docker-compose.public.yml`: `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, `mem_limit`, `pids_limit`, `tmpfs: /tmp`
- [x] `docker-compose.yml`: `cap_drop: [ALL]`, `no-new-privileges`, volume still writable
- [x] README Deploy mentions the health check
