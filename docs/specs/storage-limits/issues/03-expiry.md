---
title: EXPIRY_DAYS and last_opened_at
tags: [ticket]
date: 2026-11-26
status: done
blocked_by: []
---

# EXPIRY_DAYS and last_opened_at

Spec: [storage-limits](../spec.md).

## What to build

The `last_opened_at` column (added and filled at start), touched on load and unload; the sweep at start and hourly, skipping loaded documents; the setting in `main.ts` and the README.

## Acceptance criteria

- [x] Store tests: migration of an old table, twice; expiry by last open
- [x] Server tests: loaded documents are not swept; an MCP read counts as an open
