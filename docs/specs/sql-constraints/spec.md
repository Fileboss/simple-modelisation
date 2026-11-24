---
title: sql-constraints - UNIQUE, CHECK, named foreign keys and COMMENT ON
tags: [spec, sql, mcp]
date: 2026-11-24
status: done
---

# sql-constraints

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Unique group, Check, Comment, Attribute, Leg, MLD). Decisions: [ADR 0010](../../adr/0010-free-sql-checks-contained.md); format: [ADR 0009](../../adr/0009-additive-format-changes-after-v0-1.md).

## Problem Statement

The PostgreSQL script of an MCD only has the constraints Merise derives. A developer cannot say that an email is unique, that a price is positive, or what a column means, and PostgreSQL names the foreign keys itself, so every generated script is finished by hand and the hand work is lost at the next generation.

## Solution

- **UNIQUE**: an Attribute can be unique, and an Entity can have Unique groups (two of its Attributes or more, unique together).
- **CHECK**: an Attribute can carry a Check, a free SQL expression written with the column names of the script (`price >= 0`). One that could leave its `CHECK (...)` is refused.
- **Comments**: Entities, Associations and Attributes can carry a Comment, written as `COMMENT ON`.
- **Foreign key names**: every foreign key is named, `fk_<table>_<columns>` unless the Leg or the Inheritance link it comes from gives a name.

All are edited in the panel and over MCP, and none is drawn on the canvas. The MLD text does not change; the SQL of an existing MCD changes only by the names of its foreign keys.

## Implementation Decisions

- Optional fields, without migration: `unique`, `check`, `comment` on an Attribute; `comment` on an Entity or Association; `uniques` (lists of Attribute ids) on an Entity; `fkName` on a Leg or an Inheritance link. Absent means not set.
- A value a file or a peer wrote that does not pass the rules is left out when read, never shown nor generated. Removing an Attribute takes it out of the Unique groups; a group left with one goes.
- A Check is one line of at most 500 characters: a line break outside quotes becomes a space. Refused, with the reason: a line break in quotes; unbalanced parentheses or quotes; `;`, `--`, `/*`, `$` or a backslash outside quotes; an escape string (`E'...'`) or a backslash right before a quote. Inside quotes anything else is text. The SQL itself is not parsed: a wrong one fails in the database.
- A warning says when a Check does not name its own column, as after renaming the Attribute.
- A Comment is at most 1000 characters, written as an escape string when it holds a backslash, so that it reads the same whatever the database's settings. A table's, for an Entity or an Association with a table; an Association translated as a foreign key comments its constraint. One with nowhere to go (an Entity pushed down or up) is said in the script's notes.
- A foreign key name is a letter or `_` then letters, digits or `_`, 63 characters at most. The foreign key of a binary Association takes the name on the Leg of the Entity that receives it, else the other's; in an Association's own table, each Leg's. Generated names are cut to 63 characters and numbered when taken in the same table. Two equal names given in one table warn, and the second is numbered.
- UNIQUE on what is already the primary key, or already unique, is not written twice.
- MCP: `add_attribute`, `add_entity` and `set_attribute` take `unique`, `check`, `comment` (null clears the last two in `set_attribute`); a new `set_entity` sets an Entity's or an Association's `comment` and an Entity's Unique groups; `set_cardinality` and `set_inheritance` take `foreign_key`. `get_diagram` gives them all.

## Testing Decisions

- Model and SQL through the Project document and the generated script, as the existing SQL tests; every refused Check is a test, including attempts to leave the parentheses.
- Round trip through a file and a paste; bad values from a file or a peer left out.
- MCP through the endpoint: set, read back, clear, refuse.
- By hand, not in CI: the panel in a browser; the script run in PostgreSQL (PGlite), with a fuzz of the Check scan against expressions that do escape.

## Out of Scope

Checks across several columns as their own element, ON DELETE / ON UPDATE, other databases, constraints drawn on the canvas, UNIQUE groups on Associations.
