---
title: label-placement - Connection labels that never overlap
tags: [spec]
date: 2026-11-17
status: done
---

# label-placement

Vocabulary: [GLOSSARY](../../../GLOSSARY.md). Follows [orthogonal-routing](../orthogonal-routing/spec.md).

## Problem Statement

On a busy System design diagram, two Connection labels can sit on top of each other where their routes cross ("query" over "push tweet ids"), or on a box, so neither can be read.

## Solution

All Connection labels of a Diagram are placed together when it is drawn: each goes to the first free spot along its own route (the middle of its longest segment first, then other points of its segments), avoiding the labels already placed and every box. It works for tidied and hand-made layouts alike, and nothing is stored.

## User Stories

1. As a developer, I want every Connection label readable, so that I know each protocol at a glance.
2. As a developer, I want labels to stay on their own line, so that I know which Connection each one names.
3. As a developer, I want this after a Tidy up and after moving boxes by hand, so that labels never pile up.

## Implementation Decisions

- **Placement module** (System design, pure): from the boxes as drawn and the Connections (stored bends or the default right-angle route), computes a label position per Connection; Connections are processed in a fixed order (by id) so the result is stable. Candidates per route: the middle of each segment, longest first, then points at 30 % and 70 % of each; a candidate is free when its estimated label box (text width estimate, one line) overlaps no placed label and no box. When no candidate is free, the least overlapping one is used, a box weighing ten times a label. Label widths are measured in the canvas font.
- **Geometry** works on plain boxes (position and size), so the canvas, the placement and the edges share one implementation; edges adapt React Flow's nodes to boxes.
- The placement runs in the System design kind's drawing step; a Connection without a measured box yet keeps its default label position.
- No schema change.

## Testing Decisions

- Placement: two crossing Connections get labels that do not overlap; a label never covers a box when a free spot exists; same input, same output.
- By hand: the Twitter-like copy after a Tidy up.

## Out of Scope

Cardinality labels in MCDs; moving labels by hand; multi-line labels.
