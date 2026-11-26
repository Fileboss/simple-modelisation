---
title: Per-address limits by IPv6 /64
tags: [ticket]
date: 2026-11-26
status: done
blocked_by: []
---

# Per-address limits by IPv6 /64

Spec: [storage-limits](../spec.md).

## What to build

An address group function (IPv6 by /64, IPv4-mapped to IPv4, IPv4 as is), applied where the server reads the client address, so every per-address limit uses it.

## Acceptance criteria

- [x] Unit tests of the grouping (full, compressed, zone ids, mapped, IPv4, unknown)
- [x] A server test: two addresses of one /64 share the new-shares count
