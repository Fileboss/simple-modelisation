---
title: batch
tags: [ticket]
date: 2026-11-23
status: done
blocked_by: [1, 2]
---

# batch

Spec: [mcp-batch-attributes](../spec.md).

## What to build

The `batch` tool: write operations played all or nothing on a copy of the document, `$N` references to earlier results, one transaction applied to the Shared Project.

## Acceptance criteria

- [x] The `batch` cases of the spec's Testing Decisions pass
- [ ] Checked by hand: a batch building an MCD appears at once in an open browser (not done: covered by the one-update test)
