---
title: Tolerant reads in the Project document
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: []
---

# Tolerant reads in the Project document

Spec: [malformed-documents](../spec.md).

## What to build

One check for diagram entries (diagrams, requireDiagram), nodes and edges skipped when not maps or not under their id, name() as text, unreadable(). MCP test for the key/id mismatch.

## Acceptance criteria

- [ ] The matching tests from the spec's Testing Decisions pass
