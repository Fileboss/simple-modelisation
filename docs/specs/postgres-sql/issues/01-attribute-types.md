---
title: '01: Attribute Data types and Optional'
tags: [ticket, postgres-sql]
date: 2026-11-16
status: done
blocked_by: []
---

# 01: Attribute Data types and Optional

Part of [postgres-sql](../spec.md).

**What to build:** each Attribute of an MCD has a Data type (Integer, Big integer, Decimal(p,s), Text, Text(n), Boolean, Date, Date time, UUID, Auto-increment) and an Optional flag, edited in the properties panel next to its name. New Attributes are Text and required; a new Entity's `id` is Auto-increment. Existing documents and imported files are completed when read: an Identifier alone in its Entity becomes Auto-increment, everything else Text, all required.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Type and Optional editable per Attribute; Decimal and Text(n) parameters editable; Identifiers cannot be Optional.
- [x] Old Attributes completed when read (not rewritten on open, to avoid racing collaborators); imports store them completed; no undo step.
- [x] Import validation accepts the new fields and old files.
- [x] Tests: type and Optional operations, migration rules.
