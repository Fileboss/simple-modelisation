---
title: tidy-up-rework - a tighter Tidy up, Notes placed, vertical MCDs, and moving elements over MCP
tags: [spec]
date: 2026-11-20
status: done
---

# tidy-up-rework

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Tidy up, Note, Zone, Connection, Leg, MCD). Layout engine: [ADR 0006](../../adr/0006-elkjs-layout.md). Format changes: [ADR 0009](../../adr/0009-additive-format-changes-after-v0-1.md).

## Problem Statement

Tidy up spreads a Diagram out: every gap between layers is as wide as the longest Connection label of the whole Diagram, so one long label ("Read/Write · HTTPS + SSE") leaves wide empty bands everywhere, and Zones grow around that empty space. Notes are left where they were, so after a Tidy up they float far from what they explain. An MCD can only be laid out from left to right, while a tall MCD often reads better from top to bottom. And an agent working over MCP cannot fix what Tidy up got wrong: it cannot see where elements are, and can move only Components and Zones.

## Solution

- **Tighter**: each Connection's label takes room only where it passes; the layout is compacted, keeping a minimum gap so that routes and their bends stay readable.
- **Notes placed**: a Note follows the element nearest it before the Tidy up, on the same side, without overlapping a box, a route or another Note; when that side has no room, it goes on another side of its element. The Zones it lay in grow to hold it. A Note far from every element (more than about 200px) goes on the grid of unlinked elements under the Diagram, or is laid out with its Zone's content when it lies in one.
- **Vertical MCDs**: an MCD has a Tidy up direction, horizontal (the default) or vertical, set in the MCD's settings and stored in the Project, so every Participant tidies the same way. The Tidy up button uses it. System design diagrams stay horizontal.
- **MCP**:
  - `layout_diagram` takes an optional `direction` (`horizontal` | `vertical`); absent, the Diagram's own; `vertical` on a System design diagram is refused. Its answer reminds the agent to check the result (`get_diagram`, `export_diagram`) and adjust it with `move_elements`.
  - `move_elements` moves any elements (Component, Zone, Note, Entity, Association, CIF, Inheritance) to `x, y` or by `dx, dy`, in one step; the routes attached to them are dropped as when dragging, and a Zone takes its content along.
  - `get_diagram` gives each element's `x, y, width, height` (estimated sizes), so an agent sees the layout it adjusts.

## User Stories

1. As a developer, I want Tidy up to leave no wide empty bands, so that the Diagram fits on screen and in a README image.
2. As a developer, I want a long label to widen only the gap it crosses, so that one long label does not spread the whole Diagram.
3. As a developer, I want Zones sized tightly around their content after a Tidy up, so that they do not hold empty space.
4. As a developer, I want my Notes to stay beside what they explain after a Tidy up, so that I do not have to move them back.
5. As a developer, I want a Note posed far from everything to go with the other unlinked elements, so that it does not land in the middle of the Diagram.
6. As a developer, I want to tidy an MCD from top to bottom, so that a tall data model reads naturally.
7. As a Participant, I want the Tidy up direction of an MCD shared with everyone, so that we do not undo each other's layout.
8. As an agent, I want to choose the direction when I tidy an MCD, so that I can try both and keep the better one.
9. As an agent, I want to know where each element is and how big it is, so that I can spot overlaps or long detours.
10. As an agent, I want to move any element, alone or several at once, so that I can fix what Tidy up got wrong.
11. As an agent, I want to move by an offset, so that I can nudge a group without computing coordinates.
12. As an agent, I want `layout_diagram` to tell me to check and adjust the result, so that I do not leave a poor layout behind.
13. As a developer, I want a move by an agent to be one undo step, so that I can take it back at once.

## Implementation Decisions

- **Layout engine options** (ELK layered): each Connection gets an ELK edge label with the size of its pill, instead of a global gap computed from the widest one; post-compaction on edge length; smaller base gaps. MCD Legs have no labels on the canvas's layer: their Cardinalities stay as they are.
- **Notes**: before laying out, each Note is anchored to the nearest element within the anchoring distance (the side and gap kept) and left out of the layout; after it, the Note is placed on that side of its anchor at the same gap, further out if it overlaps a box, a route segment or a Note already placed, else on another side; the Zones it lay in grow around it. Unanchored Notes are laid out as before (with their Zone's content, or on the grid).
- **Direction**: a new optional Diagram field, `tidyDirection: 'vertical'`, absent meaning horizontal (an additive format change, ADR 0009); a value this version does not know reads as horizontal. Set through the Project document module; read by the canvas's Tidy up and by `layout_diagram`. The layout function takes the direction (`elk.direction` DOWN for vertical).
- **MCP**: `move_elements` with `moves: [{ element, x?, y?, dx?, dy? }]` (an absolute position or an offset per element, not both), elements by id or exact name; moving a Zone moves what lies inside it, as on the canvas. `get_diagram` adds `x, y, width, height` to every element.

## Testing Decisions

- External behavior only: positions and routes out of the layout function; the document after an MCP call.
- **Layout** (model, prior art: the layout tests): a Diagram with one long label is narrower than before across the gaps the label does not cross; a Note beside an element stays on its side after a Tidy up and overlaps nothing; a far Note goes on the grid; a vertical MCD has its Associations below or above their Entities rather than beside them.
- **Document**: the direction is stored, read back, survives a JSON export and import, and an unknown value reads as horizontal.
- **MCP** (prior art: `server/src/mcp.test.ts`): `layout_diagram` with `direction`, refused `vertical` on System design; `move_elements` by position and by offset, a Zone taking its content, an unknown element refused, one undo step; `get_diagram` positions.
- The canvas's Tidy up and the direction setting are checked by hand.

## Out of Scope

- Vertical Tidy up for System design diagrams.
- Zone colors and other Tidy up options (spacing): their backlog item.
- An image the agent can look at (PNG from `export_diagram`): its backlog item.

## Further Notes

- Positions are shared by every Notation, so a vertical MCD is vertical in Merise and in UML alike.
