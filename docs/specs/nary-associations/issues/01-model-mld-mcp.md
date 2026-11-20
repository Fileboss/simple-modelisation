---
title: N-ary Associations in the model, the MLD and MCP
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: []
---

# N-ary Associations in the model, the MLD and MCP

Spec: [nary-associations](../spec.md).

## What to build

`Project.addLeg(diagram, association, entity)` (a 0,n Leg; refuses other node types). `deriveMld`: an Association with three Legs or more becomes a table keyed by all its foreign keys, with the max-1 warning. MCP: `add_association` with `legs` (2+), `from`/`to` kept; `add_leg`.

## Acceptance criteria

- [ ] Model, MLD and MCP tests from the spec's Testing Decisions pass
- [ ] Binary Associations derive exactly as before (existing tests unchanged)
