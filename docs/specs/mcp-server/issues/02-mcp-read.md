---
title: '02: MCP endpoint and read tools'
tags: [ticket, mcp-server]
date: 2026-11-16
status: done
blocked_by: [1]
---

# 02: MCP endpoint and read tools

Part of [mcp-server](../spec.md).

**What to build:** the sync server answers MCP Streamable HTTP on `/mcp` with `get_project`, `get_diagram` and `get_mcd_sql`, each taking a Share link or Project id of an existing Shared Project, read through a Hocuspocus direct connection. Requests are rate limited per IP. AGENTS.md and the spec say how to add the server to Claude Code.

**Blocked by:** 01

**Status:** done

- [x] The three read tools return the Project, a Diagram's elements with ids, an MCD's MLD and SQL.
- [x] Unknown link, non-UUID and missing Diagram are clear errors; nothing lists Projects.
- [x] Rate limit per IP on `/mcp`.
- [x] Integration tests with the SDK client.
