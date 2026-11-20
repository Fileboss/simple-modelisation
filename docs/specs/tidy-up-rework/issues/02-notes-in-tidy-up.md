---
title: Notes follow their element in Tidy up
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: [1]
---

# Notes follow their element in Tidy up

Spec: [tidy-up-rework](../spec.md).

## What to build

A Note outside a Zone follows the element nearest it (within about 200px) on the same side and gap, without overlapping a box; a farther Note goes on the grid of unlinked elements; a Note in a Zone is laid out with its content as now.

## Acceptance criteria

- [ ] The Note cases of the spec's Testing Decisions pass
- [ ] GLOSSARY says Tidy up keeps a Note beside its element
