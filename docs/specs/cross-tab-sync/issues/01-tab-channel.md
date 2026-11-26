---
title: Yjs documents synced between tabs
tags: [ticket]
date: 2026-11-26
status: done
blocked_by: []
---

# Yjs documents synced between tabs

Spec: [cross-tab-sync](../spec.md).

## What to build

A tab channel module in `src/storage/`: one `BroadcastChannel`; a document joins it under its IndexedDB name, sends its updates, applies the others' with its own origin, and catches up on open (state vector, then the missing update). `openRegistry` and `openProjectDoc` join it, so the Project list and open Projects (and the rename from the list) sync between tabs. Without `BroadcastChannel`, it does nothing.

## Acceptance criteria

- [x] Unit tests with two documents on an in-memory channel: edits both ways, catching up on join, own origin (not undone), leaving stops both directions, other names ignored
- [x] The Project list and an open Project sync between two tabs (by hand)
