---
title: 01 - Flow in the model and over MCP
tags: [ticket]
date: 2026-11-19
status: done
blocked_by: []
---

# 01 - Flow in the model and over MCP

`FLOWS`, `flow` on Connections, `setConnectionFlow`, edges normalised on read; looks and names; `connect_components` flow, `set_connection` (label, flow), `get_diagram` flow.

## Acceptance criteria

- [x] Model tests: set, clear, unknown ignored, file round trip, unknown read as none
- [x] MCP tests: connect with a Flow, set_connection label and Flow, none clears, unknown Connection refused
