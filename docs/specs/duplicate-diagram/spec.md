---
title: duplicate-diagram - duplicate a Diagram
tags: [spec, mcp]
date: 2026-11-24
status: done
---

# duplicate-diagram

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Diagram, Project).

## Problem Statement

To try a variant of a Diagram, a developer selects everything, copies it and pastes it in a new Diagram, which loses the Tidy up direction; an agent has to add every element again.

## Solution

A Diagram is duplicated in one action: a button on the open tab, an entry in the phone's Diagram menu, and `duplicate_diagram` over MCP. The copy sits right after the original, is named after it, and opens for whoever made it.

## Implementation Decisions

- The copy has the same kind, elements, places, routes and Tidy up direction, with new ids for its elements; Attributes keep theirs, as in a paste, being read within their element. Links inside it (Legs, CIFs, Inheritances) point inside it. What a paste leaves out (entries this version cannot read, an element whose links are gone) is left out here too.
- Named `<name> copy`, then `copy 2`, `copy 3`… whichever is free; a copy of `X copy 2` counts on from it. Over MCP, `name` may say another.
- One undo step. The copy's `createdAt`, which orders the tabs, falls between the original's and the next one's; with no room there, the ones that follow move as little as needed. A new Diagram always comes last. Undone or deleted, the copy gives way to the original.
- `duplicate_diagram` refuses a copy that would take the Project past its size limit, writing nothing. A batch stops on the way once its copy is past the limit, rather than at the end, since each operation may add as much as the Project holds.

## Testing Decisions

- The Project document: content equal but for ids, independence from the original, names, order, undo, MCDs with a CIF, an Inheritance, Unique groups and foreign key names.
- MCP through the endpoint: alone, in a batch with `$ref`, refused when too big.
- By hand, not in CI: the tab button and the phone menu.

## Out of Scope

Duplicating into another Project.
