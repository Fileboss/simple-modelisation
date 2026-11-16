---
title: auto-layout - tidy a Diagram by its links
tags: [spec]
date: 2026-11-16
status: done
---

# auto-layout

Vocabulary: [GLOSSARY](../../../GLOSSARY.md). Ships with [mcp-server](../mcp-server/spec.md) on the same pull request.

## Problem Statement

A Diagram built element by element (by hand or by an agent) ends up with crossing Connections and Legs and elements far apart; arranging twenty boxes by hand is tedious.

## Solution

A **Tidy up** button in the canvas controls arranges the whole Diagram in layers from left to right following its Connections (System design) or Legs (MCD, each Association between its Entities), as one undo step, then fits the view; collaborators see the result. Agents get the same through the MCP tool `layout_diagram`, which the add tools recommend after adding several elements.

## User Stories

1. As a developer, I want one click to arrange a messy Diagram, so that its flow reads left to right.
2. As a developer, I want to undo a Tidy up in one step, so that I can go back to my own arrangement.
3. As an agent user, I want my agent to tidy what it drew, so that its diagrams are readable.

## Implementation Decisions

- **Layout module** in `packages/model`: dagre (`@dagrejs/dagre`) layered layout, left to right, from a Diagram's nodes, edges and a size per node; returns top-left positions. In an MCD each Association is ranked between its two Entities (one Leg reversed for the ranking).
- **Sizes**: the browser passes measured sizes; the server estimates them from names and Attribute counts.
- **Document**: positions are applied in one transaction (`arrange`), one undo step.
- **Routes** (data schema change, approved): a Tidy up also stores dagre's route of each Connection and Merise Leg as optional `points` on the edge; it is drawn through them with rounded corners. Moving an end drops the route (and a box being dragged ignores its routes). Without a route, a Connection is drawn with right angles between the sides its boxes face; a Leg stays straight, as in Looping; in UML Legs are not routed.
- **Ranking**: Clients are where flows start: a Connection into a Client ranks the other way (drawn as it is). Inputs are sorted by id so every peer computes the same layout; dagre's greedy cycle breaking handles other cycles.
- **Button**: "Tidy up" in the canvas controls, then fit view.
- **MCP**: `layout_diagram` tool; add tool descriptions point to it. No automatic layout on add.

## Testing Decisions

- Layout module: flows go left to right (a chain of three is ordered by x), no two elements overlap, an Association sits between its Entities.
- Document: `arrange` is one undo step.
- MCP integration: `layout_diagram` moves the elements without overlap.
- By hand: Tidy up on the agent-made "Twitter-like" Diagram.

## Out of Scope

Tidying only the selection; routing that avoids boxes after a manual move; other directions.
