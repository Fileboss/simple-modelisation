---
title: MAX_STORAGE_MB
tags: [ticket]
date: 2026-11-26
status: done
blocked_by: []
---

# MAX_STORAGE_MB

Spec: [storage-limits](../spec.md).

## What to build

The store's total size; a new share refused past the cap; the setting in `main.ts` and the README.

## Acceptance criteria

- [x] Server tests: a new share refused past the cap, a stored Project still opening and taking changes
