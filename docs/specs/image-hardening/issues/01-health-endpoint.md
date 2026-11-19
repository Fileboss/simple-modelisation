---
title: 01 - /health endpoint
tags: [ticket]
date: 2026-11-19
status: done
blocked_by: []
---

# 01 - /health endpoint

The server answers `GET` and `HEAD /health` with `200` `ok` (`text/plain`) and the security headers, before MCP and static files, with or without storage or a static dir.

## Acceptance criteria

- [x] `GET /health` is `200`, body `ok`, `Content-Type: text/plain`, security headers set
- [x] `HEAD /health` is `200` with no body
- [x] Works with `STORAGE=none` and without `STATIC_DIR`
- [x] Sync server integration tests cover it
