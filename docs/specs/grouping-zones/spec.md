---
title: grouping-zones - Zones grouping Components in System design diagrams
tags: [spec]
date: 2026-11-17
status: done
---

# grouping-zones

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Zone).

## Problem Statement

A System design diagram shows Components and their Connections, but not the boundaries that matter in an architecture: which region, which VPC, which private subnet each part lives in. Developers draw these boxes around Components on a whiteboard; here they cannot.

## Solution

A Zone is a named, dashed rectangle drawn under the Components. It is dropped from the palette, renamed in place, resized from its corners and sides once selected, and moved by its title bar, taking along everything drawn inside it. Zones nest (Region › VPC › Subnet). A Component belongs to the innermost Zone its box lies in: dragging it in or out is all it takes. Tidy up keeps each Zone's content inside it and fits the Zone around it. Agents add, change and remove Zones through MCP.

## User Stories

1. As a developer, I want to draw a named Zone around Components, so that the diagram shows regions, networks and subnets.
2. As a developer, I want to nest Zones, so that a subnet sits in its VPC, in its region.
3. As a developer, I want to move a Zone with its content, so that I rearrange whole parts of the system at once.
4. As a developer, I want to move a Component in or out of a Zone by dragging it, so that membership needs no extra step.
5. As a developer, I want Tidy up to respect Zones, so that tidying never breaks the grouping.
6. As an agent user, I want my agent to draw Zones and place Components in them, so that its diagrams carry the infrastructure boundaries.

## Implementation Decisions

- **Data** (schema change, approved): a new node type `zone` on System design diagrams with `name`, `x`, `y`, `width`, `height`. Nothing is stored on Components: membership is geometric (a node's box wholly inside a Zone's box; the innermost such Zone is its parent), computed when needed by one shared function of the model package. Old Projects stay valid.
- **Connections** join Components only; the model refuses a Zone as an end, and so does the file import.
- **Operations**: `addZone`, `setZoneBox` (place and size); renaming and deleting are the existing node operations (deleting a Zone keeps its content). Moving nodes keeps the stored route of a Connection whose two ends moved by the same offset (shifted), instead of dropping it.
- **Canvas**: Zones are drawn under Connections and Components, outer Zones under inner ones. Only the title bar (and the resize handles once selected) catch the pointer, so the Connections and the empty canvas inside a Zone stay clickable. Dragging a Zone moves its members (its geometric content, at drag start) by the same offset, as one move. Label placement ignores Zones as obstacles.
- **Tidy up**: when a Diagram has Zones, ELK lays it out hierarchically: each Zone a compound node holding its members, with room for its title; Connections cross Zone borders; Zones get the size ELK gives them. Without Zones, the layout is unchanged.
- **MCP**: `add_zone` (name, optional parent Zone, placed in a free spot or inside its parent), `set_zone` (rename, move, resize), `add_component` takes an optional `zone` to place the Component inside it; `get_diagram` lists Zones with their members and parent; `delete_elements` and `rename_element` accept Zones.

## Testing Decisions

- Model: add, resize, rename and delete a Zone; Connections to a Zone refused; file import validates Zones; membership (nested, partly outside, innermost wins); moving both ends shifts a route.
- Layout: with Zones, every member ends inside its Zone and Zones do not overlap siblings.
- MCP integration: add a Zone, a Component in it, `get_diagram` shows membership, `layout_diagram` keeps it.
- By hand in the browser: drop, rename, resize, move with members, nest, Tidy up, image export.

## Out of Scope

Zone colors or types (Region / VPC / Subnet styles), Connections to Zones, collapsing a Zone, Zones on MCDs.
