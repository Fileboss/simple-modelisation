---
title: orthogonal-routing - right-angle routes and fewer crossings with elkjs
tags: [spec]
date: 2026-11-16
status: done
---

# orthogonal-routing

Vocabulary: [GLOSSARY](../../../GLOSSARY.md). Follows [auto-layout](../auto-layout/spec.md); [ADR 0006](../../adr/0006-elkjs-layout.md) supersedes ADR 0005.

## Problem Statement

After a Tidy up, a busy System design diagram still has diagonal segments, avoidable crossings and labels sitting on top of each other at bends and crossings.

## Solution

Tidy up and `layout_diagram` use ELK's layered algorithm instead of dagre: System design diagrams get orthogonal (right-angle) routes with fewer crossings; MCDs keep straight or broken Legs, as in Looping. Labels sit in the middle of their route's longest straight segment, away from bends. ELK loads in the browser only on the first Tidy up.

## User Stories

1. As a developer, I want right-angle Connections after a Tidy up, so that a busy architecture reads like a clean diagram.
2. As a developer, I want fewer crossings, so that I can follow each flow.
3. As a developer, I want labels away from bends and other labels, so that I can read them.
4. As a developer, I want the app to start as fast as before, so that the layout engine costs nothing until I use it.

## Implementation Decisions

- **Layout module** (`packages/model`): ELK layered, direction right, orthogonal routing for System design diagrams, polyline for MCDs; inputs sorted by id and model order kept, so every peer computes the same layout; Clients first and the loose-element grid as before. The layout is asynchronous; ELK is imported on first use (a separate chunk in the browser).
- **Routes**: unchanged storage (inner bends as `points`, ADR 0005's approved schema); ends attach to the boxes as drawn, on the side that keeps the first and last segments straight.
- **Labels**: in the middle of the longest segment of the drawn route.
- **MCP**: `layout_diagram` reads, lays out, then writes the positions and routes.
- dagre is removed.
- **Spacing** depends on the Diagram kind (tight for MCDs, as in Looping; roomier for System design routes), and size estimates follow the real text widths of both Notations.

## Testing Decisions

- Layout: order left to right, no overlap, determinism, Clients first, Association between its Entities, every System design route segment horizontal or vertical.
- Geometry: label on the longest segment; ends attach straight.
- By hand: Tidy up on the Twitter-like copy.

## Out of Scope

Label positions computed and stored by ELK; routing that avoids boxes after a manual move.
