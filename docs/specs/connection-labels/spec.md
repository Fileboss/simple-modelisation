---
title: connection-labels - Connection labels moved along their line, and wrapped
tags: [spec, system-design, mcp]
date: 2026-11-24
status: done
---

# connection-labels

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Connection, Flow). Format: [ADR 0009](../../adr/0009-additive-format-changes-after-v0-1.md). Followed by connection-anchors, in the same pull request.

## Problem Statement

A Connection's label is placed automatically and cannot be moved; a long one is drawn on one line, as wide as it takes, over what is around it.

## Solution

A label is dragged along its own Connection, and stays on it when boxes move. One wider than 160px wraps between words. Both show the same on the canvas, in the images and to agents.

## Implementation Decisions

- An optional field on a Connection, `labelPosition`: how far along the drawn line its label is, from 0 (the start) to 1 (the arrow). Absent: placed automatically, as before. Anything else a file or a peer wrote reads as absent.
- A placed label is where it was put, clear of its own two Components and of the arrowhead where the line is long enough, whatever else it covers; the automatic ones avoid it. Moving a box, or a Tidy up, keeps the fraction, so it follows the line.
- The label lines up with the nearest point of the line under the pointer. A press without a drag selects the Connection, as before. By touch, a label is dragged once its Connection is selected, so that a finger still pans elsewhere. The panel of a Connection with a placed label has a button giving it back to the automatic placing. One undo step.
- Wrapping: between words, at 160px of text; a word longer than that is cut; at most 8 lines, the last one ending in an ellipsis. A Flow's name stays with its separator on the first line. The same lines are drawn on the canvas and in SVG, and Tidy up reserves the wrapped size.
- MCP: `connect_components` and `set_connection` take `label_position` (0 to 1; null for automatic in `set_connection`); `get_diagram` gives it.

## Testing Decisions

- Placing, wrapping and nearest point as pure functions; the Project document (set, clear, bounds, file, paste, bad values); the SVG's lines and place; Tidy up's reserved size.
- MCP through the endpoint.
- By hand, not in CI: drag by mouse and touch, click to select, undo, a box moved, reset, the image.

## Out of Scope

Labels off their line, line breaks typed in a label, MCD Cardinalities.
