---
title: connection-anchors - The ends of a Connection moved between anchors
tags: [spec, system-design, mcp]
date: 2026-11-24
status: done
---

# connection-anchors

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Anchor, Connection, Component). Format: [ADR 0009](../../adr/0009-additive-format-changes-after-v0-1.md). In the same pull request as [connection-labels](../connection-labels/spec.md).

## Problem Statement

Where a Connection leaves and reaches its Components is decided for the user: the middle of the sides they face, or where Tidy up put it. Two Connections leave from one point, and a line that would read better from another side cannot be put there. Linking to another Component means deleting the Connection and making it again.

## Solution

Once a Connection exists, each of its ends is dragged to one of 12 Anchors of its Component, or of another one. The arrow's shape stays automatic.

## Implementation Decisions

- Anchors: three on each side, at a quarter, the middle and three quarters: `top-left`, `top`, `top-right`, `right-top`, `right`, `right-bottom`, `bottom-left`, `bottom`, `bottom-right`, `left-top`, `left`, `left-bottom`.
- Optional fields on a Connection: `sourceAnchor`, `targetAnchor`. Absent: automatic, as before. An unknown value reads as absent.
- A Connection with an Anchor is drawn at right angles from it, around its own two Components, its other end on the side they face when automatic; it stores no bends, and any it has are not used. Other boxes are not avoided.
- Tidy up keeps the Anchors, ranks by the Connection as before, and stores no bends for it.
- Canvas: the only selected Connection shows a grip at each end. Dragging it shows the Anchors of the Component under the pointer, the nearest one taken; released there, the end is attached to it, on its Component or another, keeping the label, its place and the Flow; released elsewhere, or with Escape, nothing changes. Not onto its own other end's Component. One undo step. The panel has a list of the Anchors, Automatic first, for each end.
- Two Participants moving both ends at once onto one Component leave a Connection from it to itself, as a file may: it is drawn, its label and Anchors can be changed, and an end taken elsewhere.
- A new Connection is automatic.
- MCP: `connect_components` takes `from_anchor`, `to_anchor`; `set_connection` takes them too (null for automatic), and `from`, `to` to attach an end to another Component, which makes that end automatic unless its anchor is given. `get_diagram` gives the anchors. No new tool.

## Testing Decisions

- The routes as pure functions: each pair of Anchors, boxes side by side, above, diagonal, overlapping and touching: right angles, from and to the Anchors, leaving outwards, not through either box when there is room.
- The Project document, Tidy up, the SVG; MCP through the endpoint.
- By hand, not in CI: grips by mouse and touch, another Component, Escape, undo, a box moved, the panel, zoom, the image.

## Out of Scope

Bends edited by hand, avoiding other boxes, Anchors while making a new Connection, Legs.
