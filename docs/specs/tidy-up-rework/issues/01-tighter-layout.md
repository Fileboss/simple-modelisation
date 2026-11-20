---
title: Tighter Tidy up
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: []
---

# Tighter Tidy up

Spec: [tidy-up-rework](../spec.md).

## What to build

Each Connection's label takes room only where it passes (ELK edge labels sized as its pill) and the layout is compacted, with smaller base gaps that keep routes readable. Zones come out tight around their content.

## Acceptance criteria

- [ ] A long label widens only the gap it crosses (model test)
- [ ] Existing layout tests pass, adjusted only where the tighter gaps change numbers
- [ ] Checked by hand on a System design diagram and an MCD
