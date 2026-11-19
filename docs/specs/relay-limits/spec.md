---
title: relay-limits - bound what one client can do to a public relay
tags: [spec]
date: 2026-11-19
status: done
---

# relay-limits

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Shared Project, Share link, Participant, Presence). Before v0.1: the first public deployment is a relay ([relay-mode](../relay-mode/spec.md), [app-hardening](../app-hardening/spec.md)).

## Problem Statement

A review before v0.1 found that one client can still break a public relay for everyone, and that a Share link holder can break other Participants:

- one address can load every document slot (`MAX_DOCUMENTS`) through one socket's worth of shares, and every real share is then refused as busy;
- the example public deployment publishes its port on every interface while trusting `X-Forwarded-For`, so a client reaching it directly picks its own address and escapes every per-address limit;
- a single message up to four times the document limit is applied before the size is checked, so documents outgrow the memory the deployment is sized for;
- on a relay, a document's size is a running total of every update, never recomputed, so a long editing session marks a small document full;
- Presence messages have no size bound;
- a peer can write a node or edge field of the wrong type (a string `x`, `attributes` that are not a list) which the SVG export writes into attributes unescaped, or which crashes every canvas and MCP read;
- the per-address creation counts are never forgotten.

## Solution

- **Documents per address**: a document loaded into memory because an address opened it counts for that address until it is unloaded; joining a document already open does not count. Past 10 per address, opening is refused as busy. Both modes.
- **Deployments**: the public example (the one trusting the proxy) publishes the port on `127.0.0.1` only, so only a proxy on the host reaches it; the README says `TRUST_PROXY=true` only when the port is reachable by the proxy alone. The stored example trusts no proxy and stays reachable directly.
- **Message size**: a change message that would take the document past its limit is not applied; the connection becomes read-only and the client says the Project is full, as today.
- **True size**: when the running size passes the limit, the document's real encoded size is computed and taken instead; only if that is over the limit is the document full.
- **Presence**: a Presence message over 64 KB closes its connection, as a message flood does.
- **Peer fields**: reading a Diagram ignores any element that an imported file would refuse (the same rules), so it is neither drawn, exported nor read over MCP.
- **Housekeeping**: addresses without recent creations are forgotten.

## User Stories

1. As a Participant on the public relay, I want one client unable to take every document slot, so that I can still share.
2. As an operator, I want the example deployment to accept connections only through my proxy, so that per-address limits see real addresses.
3. As an operator, I want no document to grow past the limit in one message, so that the memory limit holds.
4. As a Participant editing for hours on a relay, I want my Shared Project not to be declared full while it is small, so that I can keep working.
5. As a Participant, I want Presence bounded, so that nobody floods my browser or the server through it.
6. As a Participant, I want a malformed element written by another Share link holder ignored, so that my canvas keeps working and my exports carry no injected script.
7. As an agent, I want MCP reads unaffected by a malformed element, so that I can keep reading the Project.
8. As an operator, I want the server's per-address bookkeeping bounded, so that it does not grow forever.

## Implementation Decisions

- **Server options** (defaults, no new environment variable): documents per address 10, Presence message 64 KB. The README's limits line names them.
- **Address of a load**: the address is attached at authentication when the document is not yet loaded (or not yet opening); released when the document unloads, or when its opening fails or goes stale. Counted with the openings in progress.
- **Message checks** in the message hook, from the raw message: the message type tells a change from Presence. A change: running size plus the message length over the limit → read-only and notified, the message dropped. The running size passing the limit → recompute from the document first.
- **Reading**: the Project document's node and edge reads keep only elements valid by the import rules of their Diagram's kind (edges also need valid ends), then complete them as today. Writes are unchanged.
- **Compose**: `127.0.0.1:3000:3000` in the public file, with a comment.

## Testing Decisions

- Server integration tests (prior art: the sync server tests with real providers): an address past 10 loaded documents is refused busy, joining an open one is not counted, unloading frees the count; an oversized single change makes the connection read-only and is not applied; a relay document whose running total passes the limit while its real size is small stays writable; an oversized Presence message closes the connection.
- Model tests (prior art: project and paste tests): a peer-written node with a string `x`, or non-list `attributes`, is left out of reads, and the SVG export carries no unescaped attribute text.
- Behaviour only: refusals as clients see them, reads as callers see them.

## Out of Scope

The MCP endpoint's own bookkeeping (reads that store, its document count, its size check): BACKLOG.md after v0.1. Rate limits on Presence frequency beyond the existing message limit.
