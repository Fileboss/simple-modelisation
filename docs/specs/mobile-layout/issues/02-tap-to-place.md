---
title: Tap to place - adding from the Palette with a finger
tags: [ticket]
date: 2026-11-20
status: done
blocked_by: [1]
---

# Tap to place

Spec: [mobile-layout](../spec.md).

## What to build

A shared `useCoarsePointer` hook replacing the `coarsePointer` constant. On a coarse pointer, tapping a Palette item arms it (drawer closes on small screens), a hint with Cancel shows on the canvas, and the next tap on the canvas places it through the drop path (preview, snapping). Pan and pinch still work while armed. Cancel, Escape or the + button disarm. The mouse keeps dragging.

## Acceptance criteria

- [ ] Every Palette item of both kinds (Components, Zone, Person, Note, Entity, Association) can be placed by tap
- [ ] A pan or pinch while armed does not place
- [ ] Unit tests on arming, disarming and the tap-vs-drag threshold
