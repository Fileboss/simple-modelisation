---
title: '01: Origin, message limits, timeouts, headers; review and SECURITY.md'
tags: [ticket, app-hardening]
date: 2026-11-19
status: done
blocked_by: []
---

# 01: Origin, message limits, timeouts, headers; review and SECURITY.md

Part of [app-hardening](../spec.md).

**What to build:** the server refuses other origins, oversized and flooding messages, slow clients, and serves the app with a strict CSP and security headers; the exposed code is reviewed and SECURITY.md written.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Origin check, message size and rate limits, HTTP timeouts; integration tests.
- [x] Security headers and CSP; the whole app checked by hand under it.
- [x] Security review; findings fixed or recorded.
- [x] SECURITY.md.
