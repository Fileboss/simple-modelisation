---
title: storage-limits - A server with storage cannot be filled
tags: [spec, server]
date: 2026-11-26
status: done
---

# storage-limits

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Shared Project, Share link, Participant). Server: [ADR 0003](../../adr/0003-hocuspocus-single-node-server.md), [ADR 0011](../../adr/0011-stored-documents-expire-by-last-open.md).

## Problem Statement

A server with storage (`STORAGE=sqlite`) keeps every Shared Project forever, with no cap on the total. The only brake on new shares is 30 per hour per address, and an address is an exact IP: one IPv6 host holds a whole /64, so it can rotate addresses and share without limit. A public server with storage can be filled until its disk is full.

## Solution

- **Addresses grouped by /64:** every per-address limit (new shares per hour, open documents, connections, MCP requests) counts an IPv6 address by its /64 prefix. IPv4, and IPv4-mapped IPv6 (`::ffff:1.2.3.4`), count per address. The logs show the group.
- **A cap on storage:** `MAX_STORAGE_MB` (default `1024`) bounds the stored documents' total size. Once it is reached, a new share is refused for good (the app says "Sharing refused by the server: changes stay on this device"). Shared Projects already stored keep opening and taking changes, each still capped at 5 MB, so the total can pass the cap by what they grow.
- **Expiry, opt-in:** `EXPIRY_DAYS` (unset by default: never) deletes a stored Shared Project nobody has opened for that many days. Being opened means being loaded by a Participant or an agent over MCP; a Project still held in memory is never deleted, and its last open is when it leaves memory. Expired Projects are swept at start and every hour, and each one is logged.
- **Schema:** the `documents` table gains `last_opened_at`, filled from `updated_at` for existing rows ([ADR 0011](../../adr/0011-stored-documents-expire-by-last-open.md)).

A Participant whose browser still holds an expired Project shares it again on their next open, as in relay mode: their copy comes back to the server, as a new share.

## Acceptance Criteria

- [x] Two IPv6 addresses of one /64 share one count for new shares, open documents and connections; two IPv4 addresses do not; `::ffff:1.2.3.4` counts as `1.2.3.4`.
- [x] Past `MAX_STORAGE_MB`, a new share is refused with REFUSAL.refused, and a stored Project still opens and takes changes.
- [x] With `EXPIRY_DAYS`, a Project not opened for longer is deleted by the sweep, one opened recently or held in memory is not; reading it over MCP counts as opening it.
- [x] A database without `last_opened_at` gains it at start, filled from `updated_at`; starting again changes nothing.
- [x] `MAX_STORAGE_MB` and `EXPIRY_DAYS` are refused at start unless positive integers; the README's Deploy section lists them.

## Out of Scope

- Deleting a Shared Project on request (needs Project owners, like revoking a Share link).
- Quotas per address on stored bytes.
- Telling a Participant in advance that their Shared Project will expire.
