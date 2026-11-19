---
title: relay-mode - sharing without server storage, for a public deployment
tags: [spec]
date: 2026-11-19
status: done
---

# relay-mode

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Local Project, Shared Project, Share link, Participant).

## Problem Statement

A first public deployment should offer Local Projects and sharing, but keep nothing on the server: stored documents cost disk, invite abuse (anyone can share as much as the limits allow) and make the operator responsible for what people put there. Today a Shared Project is always stored in SQLite, and the MCP endpoint reads and writes it.

## Solution

A deployment setting turns the server into a relay: Shared Projects live in its memory only while at least one Participant has them open, and are forgotten when the last one leaves. Every Participant keeps the Project in their browser, as today; the first one back brings it to the server again and Yjs merges what each did meanwhile. A Share link opens only while someone has the Project open; otherwise the page says so, rather than "not found". The number of documents in memory is capped: past it, a new share is refused with a clear status. The MCP endpoint is off in this mode. The default deployment (SQLite storage, MCP on) is unchanged.

## Implementation Decisions

- **Settings** (environment): `STORAGE=sqlite|none` (default `sqlite`), `MCP=on|off` (default `on`, and `off` when `STORAGE=none`; asking for both refuses to start, since the MCP works on stored documents), `MAX_DOCUMENTS` (documents in memory at once, default 500, in both modes).
- **Relay**: without storage, a document exists while it is loaded; `share` may load (create) one within the limits (creations per address, documents in memory), `join` only opens a loaded one. Refusals carry a reason the app shows: nobody has it open (join), the server is full (share).
- **App**: the Share link page explains "Nobody has this Project open right now: ask whoever shared it to open it"; a Shared Project refused for capacity shows a "Sharing unavailable: the server is busy" status and keeps working locally.
- **Docs**: a deployment section in the README (settings, reverse proxy and `TRUST_PROXY`, the public relay example) and a `docker-compose.public.yml` example.

## Testing Decisions

- Sync server integration: in relay mode, no SQLite file; sharing and joining while open; after everyone leaves, joining is refused with the "not open" reason and sharing again brings the content back; the document cap refuses a new share with the "full" reason; MCP answers 404.
- By hand: the two app messages.

## Out of Scope

Peer-to-peer sync without a relay; accounts; revoking links.
