---
title: mcd-areas - free colored Areas behind an MCD
tags: [spec, mcd, mcp]
date: 2026-11-24
status: done
---

# mcd-areas

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Area, MCD, Zone, Note). Format: [ADR 0009](../../adr/0009-additive-format-changes-after-v0-1.md).

## Problem Statement

On an MCD there is no way to point at a part of the model ("Billing", "to review"): a Note says something beside it, but does not show what it is about. Zones are for System design diagrams, and hold what is in them.

## Solution

An Area: a light colored rectangle behind everything, with one optional label, put anywhere, at any size, in one of eight colors. It holds nothing and constrains nothing: it moves alone, the elements over it move without it, and Tidy up leaves it where it is, for the user to adjust.

## Implementation Decisions

- A new node type, `area`, on MCDs only: `x`, `y`, `width`, `height`, `label` (one line, 200 characters at most, may be empty), `color` (blue unless set: yellow, orange, red, pink, purple, blue, teal, green). Not a Zone: no membership, no name by which other tools could find it. An older app leaves Areas out of a Shared Project, and refuses a file holding one.
- Any size from 40 by 24 up. Neither its drag nor its resize snaps, and nothing snaps to it; dragged with other elements, those snap as if alone.
- Always behind: Areas under the lines and boxes, the bigger under the smaller.
- Selected and moved by its label or its border; its inside is the background (a click deselects, a drag selects). Once selected, eight handles resize it.
- Panel: label and color. The label is also edited in place.
- Ignored by Tidy up (not moved, not avoided), the MLD, the SQL, and the placing of new elements by agents. Drawn in SVG and PNG exports, in both Notations, copied, pasted and duplicated like any element.
- MCP: `add_area` (a box, or the elements to draw it around), `set_area` (label, color, box); `get_diagram` lists `areas`; `move_elements` and `delete_elements` take their ids. 34 tools.

## Testing Decisions

- The Project document: add, change, bounds, bad values from a file or a peer, file and paste, refused on a System design diagram.
- Tidy up: same layout with and without Areas, Areas not moved. SVG: drawn first, in order, escaped, in the frame.
- MCP through the endpoint.
- By hand, not in CI: selecting, moving, resizing, selecting inside, the label in place, a phone.

## Out of Scope

Areas on System design diagrams, carrying elements, shapes other than a rectangle.
