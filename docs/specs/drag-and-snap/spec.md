---
title: drag-and-snap - drop where it is shown, snap to neighbours with guides
tags: [spec]
date: 2026-11-19
status: done
---

# drag-and-snap

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Component, Zone, Connection, Entity, Association).

## Problem Statement

Dropping an element from the palette creates it with its top-left corner under the cursor, while the browser showed the palette item grabbed wherever it was clicked: the element lands below and to the right of where it seemed to go, and the dragged image is neither its size nor its look. Moving elements is free-hand only: lining boxes up, or making a Connection straight, takes care and still ends a few pixels off.

## Solution

- **Drop**: while dragging from the palette, the canvas shows a preview of the element at its real size, centred on the cursor (the browser's drag image is hidden); the element is created exactly where the preview is, snapping included.
- **Snapping** on every move, in System design diagrams and MCDs: an element's left, centre and right edges snap to those of the other elements, and its top, middle and bottom to theirs, within 6 screen pixels; the aligned edges show as guide lines across the elements they align. Elements joined to the moved one come first: their centres snap first, so a Connection or a Leg becomes a straight line.
- It applies to one element, to a multiple selection (its bounding box), to a Zone dragged with its content (the Zone's box), and to a Zone's sides while it is resized.
- Holding **Alt** (Option on a Mac) during a drag places freely.

## Implementation Decisions

- **Snapping module** (`src/canvas/snapping.ts`, pure): `snap(moving: Box, targets: Box[], options: { threshold, linked: Set<id> })` returns the offset to apply and the guides to draw. On each axis independently, the closest of the nine edge pairs (start, centre, end against start, centre, end) within the threshold wins; a linked target's centre wins over any other pair within the threshold. Guides span from the moving box to every target aligned on the winning coordinate. The threshold is 6 px divided by the zoom.
- **Targets**: the other nodes as drawn (React Flow's measured boxes), minus the moving ones and, for a Zone, what it carries; Zones count as targets. Linked: the nodes sharing a Connection (System design) or a Leg (MCD) with a moving one.
- **Drag**: followed from the pointer (where the button went down, and where it is now) applied to where the dragged nodes started, then snapped; the position changes React Flow reports are replaced by those, since it reads the positions it is given back and a snapped one would drift into its next step. What is shown is what `onNodeDragStop` saves; the content a Zone carries follows the snapped Zone.
- **Resize**: a Zone's moving sides snap to the same targets; `setZoneBox` gets the snapped box.
- **Drop preview**: on `dragenter`/`dragover` with the palette MIME type, a translucent box of the item's size (the model's estimated size: Component, Zone default, Entity) is drawn centred on the cursor and snapped; the browser's drag image is replaced by an empty one. On drop, `kind.drop` gets the preview's top-left and returns the new element's id; once the canvas has measured it, it is centred on the drop point and snapped again at its real size, in the same undo step. Leaving the canvas hides the preview.
- **Guides**: thin red lines over the canvas, as in design tools (an SVG in a `ViewportPortal`, in flow coordinates, a non-scaling 1px stroke), shown during a drag, a resize or a drop preview only.
- **Alt**: read from key and pointer events on the window; while held, no snap and no guides.
- **Empty Diagram**: it is not framed when it opens, or React Flow would frame the first element dropped on it and move it away from the pointer.

## Testing Decisions

- Snapping module, unit: snaps left to left, centre to centre, right to right; nothing beyond the threshold; the closest pair wins; a linked centre wins over a closer edge; axes independent; guides list the aligned targets.
- By hand (e2e is manual for now): drop each palette item and see it land under the preview; drag a Component near another (edges, centres), a linked one (straight Connection), a multiple selection, a Zone with content, resize a Zone; Alt disables; MCD Entities too.

## Out of Scope

Equal-spacing guides; snapping to the background grid; a snapping on/off setting; snapping for agents (MCP places through Tidy up).
