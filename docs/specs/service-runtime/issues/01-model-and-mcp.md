---
title: 01 - Runtime in the model, new Skin catalog, MCP
tags: [ticket]
date: 2026-11-19
status: done
blocked_by: []
---

# 01 - Runtime in the model, new Skin catalog, MCP

`RUNTIMES`, `runtime` on Services and `setRuntime`; the Service Skins as frameworks then products, the Client Skins as devices; their looks and names; MCP `add_component` / `set_component` take `runtime`, the views show it.

## Acceptance criteria

- [x] `setRuntime` works on a Service, is ignored elsewhere and for an unknown value; changing the type drops it; reading drops it off Services
- [x] Removed Skins read as Generic
- [x] MCP: runtime set, cleared, refused off Services; listed in views and descriptions
- [x] Tests for all of the above
