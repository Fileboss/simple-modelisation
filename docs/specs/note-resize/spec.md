---
title: note-resize - Notes can be made wider or narrower
tags: [spec]
date: 2026-11-20
status: done
---

# note-resize

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Note). Format changes: [ADR 0009](../../adr/0009-additive-format-changes-after-v0-1.md).

## Problem Statement

Every Note is 180px wide, its height following its text. A long Note becomes a tall narrow column that does not fit the Diagram around it, and a short one cannot be made narrower to slip between two elements.

## Solution

A selected Note shows handles on its left and right sides; dragging them sets its width, from 120 to 600px, its text wrapping to it and its height still following the text (never cut). The width is stored in the Project, shared with every Participant, kept in a JSON export, and used wherever a Note is drawn or measured: the SVG and PNG exports, the zip, Tidy up and MCP. The resize snaps to alignment guides like a Zone's (Alt to keep it free) and is one undo step. Over MCP, `set_note` takes a `width`, and `get_diagram` gives each Note's width.

## User Stories

1. As a developer, I want to make a long Note wider, so that it reads as a short block rather than a tall column.
2. As a developer, I want to make a short Note narrower, so that it fits between two elements.
3. As a developer, I want the text never cut, so that resizing cannot hide part of a Note.
4. As a developer, I want the resize to snap to the elements around, so that the Note lines up with them.
5. As a Participant, I want everyone to see the width I chose, so that the Diagram looks the same for all.
6. As a developer, I want exports to keep the width, so that the README image matches the canvas.
7. As an agent, I want to set a Note's width, so that I can fit it in a layout I am fixing.

## Implementation Decisions

- **Document**: an optional `width` on a Note (an additive format change, ADR 0009): absent, the default 180px; rounded and kept between 120 and 600px; a value that is not a number reads as absent. Set through the Project document module, with the Note's `x` when its left side moves.
- **Sizes**: the model's Note size and its text lines take the Note's width; everything measuring or drawing a Note goes through them.
- **Canvas**: left and right resize controls on a selected Note (horizontal only); the snap gestures handle a Note's resize as a Zone's, saving its `x` and width at the end.
- **MCP**: `set_note` gains `width`; `get_diagram` gives each Note's `width`.

## Testing Decisions

- External behavior: the document after a width is set (stored, rounded, bounded, kept in a JSON round trip, a bad value read as absent); the Note's size and lines at a width; the SVG Note at its width; MCP `set_note` with `width`. Prior art: the Project document, SVG and MCP tests.
- The resize gesture is checked by hand.

## Out of Scope

- Resizing other elements (Components, Entities, Associations): later.
- A Note's height set by hand.
