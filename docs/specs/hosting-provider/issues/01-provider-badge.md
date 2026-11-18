---
title: '01: Provider badge, panel and MCP'
tags: [ticket, hosting-provider]
date: 2026-11-18
status: done
blocked_by: []
---

# 01: Provider badge, panel and MCP

Part of [hosting-provider](../spec.md).

**What to build:** Components carry an optional Provider, shown as a badge beside the Hosting, picked in the panel, set by agents through MCP.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] `provider` in the model with its operation, validation and tests.
- [x] Badge and panel grid.
- [x] MCP: `add_component` provider, `set_provider`, `get_diagram`; integration test.
- [x] Verified by hand in the browser.
