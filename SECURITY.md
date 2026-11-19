---
title: Security
tags: [security]
date: 2026-11-19
---

# Security

What simple-modelisation protects, what it does not, and why. Deployment settings are in the README's Deploy section.

## Reporting a vulnerability

Open a [private security advisory](https://github.com/Fileboss/simple-modelisation/security/advisories/new) on GitHub rather than a public issue.

## The model

There are no accounts. A **Local Project** never leaves the browser. A **Shared Project** is reached by its Share link, a random UUID (122 bits): holding the link is the only permission, and it gives full read and write access. Anyone you send the link to, and anyone they forward it to, can read and change the Project.

On a server with storage (`STORAGE=sqlite`), Shared Projects are kept in a SQLite file, readable by whoever runs the server. On a relay (`STORAGE=none`), the server keeps a Shared Project in memory only while someone has it open, and writes nothing to disk. Either way the server sees Projects in clear: there is no end-to-end encryption.

## What the server defends against

- **Other sites**: a browser's WebSocket upgrade to `/sync` is refused unless it comes from the app's own pages (its `Origin` names the host it asks). Another site can neither drive a visitor's browser against the server nor use it as its own sync backend. Clients that are not browsers send no `Origin` and are let through: they could forge any header anyway.
- **Injected scripts and framing**: every page is served with a strict Content Security Policy (scripts from the app only, no `eval`, no plugins, no forms, no framing), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Cross-Origin-Opener-Policy: same-origin`. Styles may be inline: the canvas positions nodes with style attributes.
- **Leaking Share links**: `Referrer-Policy: no-referrer`, since a Share link is a secret in the URL.
- **Saturation**, so that one client cannot take the server down:
  - per document: 5 MB, after which it turns read-only;
  - per connection: one message is at most four documents' worth (a larger one closes it), and at most 1000 messages in 10 seconds, counted per socket;
  - per address: 50 connections, and 30 new Shared Projects an hour on a server with storage;
  - for the whole server: `MAX_DOCUMENTS` in memory at once.

  Slow clients are cut off: 10 s for the headers and 30 s for a request, checked every 30 s, so within about 40 s at worst.

- **Logs**: a refusal logs one line, without a stack trace, so a flood of refusals cannot fill the disk with traces.
- **MCP**: off on a relay. On a server with storage it reads and edits only existing Shared Projects, given their link, and has its own rate limit.
- **Peer data**: a Participant's Presence is checked before use (a plain hex color, a name of at most 32 characters, well-formed cursor and selection). Peers' edits are rendered as text by React or escaped in exported SVG, never as HTML; the SVG renderer reads only its own catalog entries, whatever a document holds.

## What it does not protect

- **A leaked Share link is a leaked Project**: there is no way yet to revoke a link for everyone. Stop sharing keeps a private copy on your device, but the shared one stays with whoever has the link.
- **Vandalism**: anyone with the link can delete or rewrite a Shared Project. Undo covers your own changes only, and with storage the server keeps no history. Export Projects you care about as JSON.
- **The server operator** sees Shared Projects in clear, and with storage keeps them on disk.
- **A relay keeps nothing**: when every Participant has lost their browser copy, the Project is gone.
- **Your browser**: Local Projects are in IndexedDB, as safe as the device and the browser profile.
- **TLS and HSTS** are the reverse proxy's job; run the server behind one that terminates HTTPS, sets `X-Forwarded-For` (with `TRUST_PROXY=true`) and keeps the `Host` header.

## Supply chain

Dependencies are watched by Dependabot and scanned by Trivy in CI; the history is scanned for secrets by gitleaks; GitHub Actions are pinned by commit.
