---
title: mcd-show-types - The PostgreSQL types shown in an MCD's boxes
tags: [spec, mcd, mcp]
date: 2026-11-25
status: done
---

# mcd-show-types

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (MCD, Entity, Association, Attribute, Data type, Notation, Tidy up).

## Problem Statement

In Merise, a box lists its Attributes by name only: to know their types one selects each Entity, or reads the SQL.

## Solution

A switch in an MCD's palette shows, beside each Attribute of its Entities and Associations, the PostgreSQL type it becomes in the script, in grey italics.

## Implementation Decisions

- A preference per browser and per MCD, like the Notation: off by default, never in the Project. Where storage is blocked, it lasts until the page reloads.
- Merise only: the switch is not shown in UML, which keeps writing the conceptual Data types.
- The type is the one the PostgreSQL script gives the Data type (`SERIAL`, `VARCHAR(120)`, `JSONB`), alone: no NOT NULL nor UNIQUE, no foreign keys. Only the Identifier's name is underlined.
- In an Entity, names on the left and types aligned on the right. In an Association, whose lines are centered, the type follows the name.
- The grey reads on the Entity's yellow and the Association's cyan (WCAG AA). Double-clicking the type edits the name, as a UML line does.
- Boxes grow to the right; nothing moves when the switch is turned, and the Legs follow. Tidy up always reserves the room of the types, shown or not, Associations included, since positions are shared and the preference is not.
- The images, the all-diagrams zip included, show what this browser shows. The estimate of a box's size counts the types only when an image draws them.
- MCP: `export_diagram` takes `types` (default false), ignored in UML and on System design diagrams.

## Testing Decisions

- Sizes (estimated, reserved by Tidy up) and the SVG's lines, in the model package; the preference, in the app.
- MCP through the endpoint.
- By hand, not in CI: the switch, both boxes, renaming by double-click, the switch hidden in UML, reload, an image.

## Out of Scope

PostgreSQL types in UML, types of other databases, moving boxes apart when the switch is turned.
