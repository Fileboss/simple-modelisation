---
title: '03: MCP write tools'
tags: [ticket, mcp-server]
date: 2026-11-16
status: done
blocked_by: [2]
---

# 03: MCP write tools

Part of [mcp-server](../spec.md).

**What to build:** the write tools (`add_diagram`, `add_component`, `connect_components`, `set_skin`, `add_entity`, `add_attribute`, `add_association`, `set_cardinality`, `rename_element`, `delete_elements`) apply Project document operations in one transaction per call through the direct connection, with validated inputs, references by id or exact name (ambiguity errors) and automatic placement on a grid next to existing elements. Connected clients see the edits live.

**Blocked by:** 02

**Status:** done

- [x] Every write tool works and validates its input.
- [x] Names or ids accepted; ambiguous and unknown names are errors listing candidates.
- [x] New elements never overlap existing ones.
- [x] Integration tests: an agent's add reaches a connected Yjs client; reference errors.
- [x] Verified by hand with Claude Code against the local server.
