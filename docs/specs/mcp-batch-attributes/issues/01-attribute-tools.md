---
title: Attribute tools
tags: [ticket]
date: 2026-11-23
status: done
blocked_by: []
---

# Attribute tools

Spec: [mcp-batch-attributes](../spec.md).

## What to build

`set_attribute` (name, type, Identifier, NULL, position) and `remove_attribute` over MCP, with the Project document operation that moves an Attribute to an index.

## Acceptance criteria

- [x] The `set_attribute` and `remove_attribute` cases of the spec's Testing Decisions pass
