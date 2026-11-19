---
title: 02 - Per-address documents, message size, true size, Presence bound
tags: [ticket]
date: 2026-11-19
status: done
blocked_by: []
---

# 02 - Per-address documents, message size, true size, Presence bound

The sync server bounds documents loaded per address (10), checks a change's size before applying it, recomputes the real size at the limit, closes connections sending Presence over 64 KB, and forgets old creation counts.

## Acceptance criteria

- [x] Server tests from the spec
- [x] README limits line updated
