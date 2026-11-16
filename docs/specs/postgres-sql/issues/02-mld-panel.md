---
title: '02: MLD derivation and panel'
tags: [ticket, postgres-sql]
date: 2026-11-16
status: done
blocked_by: [1]
---

# 02: MLD derivation and panel

Part of [postgres-sql](../spec.md).

**What to build:** a pure module derives the MLD from an MCD with the Merise rules of the spec (tables, primary keys, foreign keys, UNIQUE, association tables, snake_case naming, reflexive suffixes, ordering, warnings). Under the MCD canvas, a collapsible panel shows the MLD in Looping's notation with primary keys underlined, live, with Copy and Download (.txt) and the warnings.

**Blocked by:** 01

**Status:** done

- [x] Derivation covers the spec's rules and warnings.
- [x] Panel under the MCD, collapsible (remembered per browser), MLD updates while editing.
- [x] Copy gives plain text; Download saves `<diagram>.txt`.
- [x] Tests: the spec's cases on the MLD.
