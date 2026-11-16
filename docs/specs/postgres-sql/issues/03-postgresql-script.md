---
title: '03: PostgreSQL script'
tags: [ticket, postgres-sql]
date: 2026-11-16
status: done
blocked_by: [2]
---

# 03: PostgreSQL script

Part of [postgres-sql](../spec.md).

**What to build:** the SQL tab of the panel shows the PostgreSQL script of the MLD: `CREATE TABLE` with types, NOT NULL, primary keys, UNIQUE and foreign keys, tables ordered so references exist, circular foreign keys added by `ALTER TABLE`, reserved words quoted, warnings as comments. Copy and Download (.sql).

**Blocked by:** 02

**Status:** done

- [x] Script for every case of the spec, live under the MCD.
- [x] Copy and Download `<diagram>.sql`.
- [x] Tests: the spec's cases on the script.
- [x] Every case's script runs without error on a real PostgreSQL (Docker), by hand.
