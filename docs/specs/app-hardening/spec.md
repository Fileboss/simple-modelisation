---
title: app-hardening - the exposed server, hardened for a public relay
tags: [spec]
date: 2026-11-19
status: done
---

# app-hardening

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Shared Project, Share link, Participant).

## Problem Statement

v0.1 is a public relay reachable by anyone. Today the WebSocket endpoint accepts any site's pages (another site could use it as a free sync backend, or drive a visitor's browser against it), any message size up to the WebSocket default, and any message rate; the HTTP server keeps slow connections open as long as they like; and the app is served without security headers, so a script injected one day would run unhindered and the page could be framed by any site.

## Solution

The server defends itself, whatever proxy sits in front: WebSocket upgrades only from the app's own origin, messages capped in size and in rate per connection, HTTP timeouts against slow clients, and every page served with a strict Content Security Policy and the usual security headers. A security review of the exposed code goes with it, and a `SECURITY.md` says what the app protects and what it does not.

## Implementation Decisions

- **Origin**: a browser upgrade to `/sync` is refused unless its `Origin` names the same host name as the host it asks: `X-Forwarded-Host` behind a trusted proxy, else `Host` (Vite's proxy and Caddy keep it); ports are not compared, a proxy may add one. Clients that send no `Origin` (not browsers) are allowed: they can forge any header anyway, the check only stops other sites' pages.
- **Messages**: a WebSocket message is at most four times the document size limit (so an oversized first sync still reaches the size check and is told the document is too large; past that, the socket closes with 1009 and the app stops retrying); a socket sending more than 1000 messages in 10 seconds is closed and its queue dropped (cursor Presence alone sends up to 200).
- **HTTP**: 10 s to send the headers, 30 s for a request, idle keep-alive 5 s; Node checks them every 30 s.
- **Headers** on every response (pages, assets, errors, MCP): `Content-Security-Policy` `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` (inline styles: React Flow positions nodes with style attributes), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` (Share links are secrets in the URL), `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy` denying camera, microphone, geolocation, payment, USB. HSTS stays with the TLS proxy.
- **Review**: Claude Code's security review over the server and the code that renders user text; findings fixed or listed in SECURITY.md.

## Testing Decisions

- Sync server integration: an upgrade from another origin is refused, the app's origin and no origin pass; an oversized message closes the connection; a message flood closes it; static responses carry the headers; slow-header timeouts are set.
- By hand: the whole app under the CSP (canvas, Tidy up, image exports, imports, sharing) with no CSP violation in the console.

## Out of Scope

End-to-end encryption of Shared Projects; authentication; the deployment's proxy (HSTS, TLS).
