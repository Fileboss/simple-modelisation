---
title: 03 - Smoke test of the image at the tag
tags: [ticket]
date: 2026-11-19
status: done
blocked_by: [2]
---

# 03 - Smoke test of the image at the tag

`docker.yml` builds and loads the image, runs it as a relay, waits for `healthy`, checks `/health`, `/` (HTML with a CSP header) and the absence of npm and pnpm, and only then pushes to ghcr.

## Acceptance criteria

- [x] The check script runs locally against a built image and passes
- [x] A failing check stops the push
- [x] Actions stay pinned by commit
