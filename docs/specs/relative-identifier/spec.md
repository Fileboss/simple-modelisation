---
title: relative-identifier - Entities identified relative to others
tags: [spec]
date: 2026-11-20
status: done
---

# relative-identifier

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Entity, Identifier, Association, Leg, Cardinality, MLD, Notation).

## Problem Statement

Some Entities are only identified within another: an order Line is line 3 _of order 1024_, a Room is room 12 _of building B_. Merise says so with a relative identifier: the 1,1 Leg from the dependent Entity is marked, and its table's key includes the other Entity's key. Today the MLD gives the Line its own key and a plain foreign key, which allows two "line 3" in one order and needs a surrogate id.

## Solution

A Leg with the Cardinality 1,1 on a binary Association can be marked **relative** (R): the Entity on that Leg is identified relative to the Entity on the other Leg.

- **Marking**: in the Leg's panel (and the Association's list of Legs), in the Merise Notation, a "Relative identifier (R)" checkbox, offered on a 1,1 Leg of a binary Association. Changing the Cardinality away from 1,1 clears it.
- **Merise**: the Cardinality reads `1,1 R`.
- **UML**: a composition: a filled diamond at the class of the other Entity, which owns the dependent one.
- **MLD**: the dependent Entity's table is keyed by the foreign key to the other Entity's table, first, then its own Identifier (`line = (#order_id, number INTEGER, …)`, key `(order_id, number)`). An Entity with several relative Legs is keyed by all those foreign keys; chains compose (a relative of a relative takes the whole key). The Association adds nothing else; its Attributes go to the dependent table, as for any 1,1.
- **Ignored, with a warning**: a relative Leg on an N-ary or a reflexive Association; a cycle of relative identifiers.
- **MCP**: `set_cardinality` takes `relative` (true or false); `get_diagram` shows it on each Leg.

## Implementation Decisions

- **Model**: a Leg field `relative: true`, absent otherwise. `setRelative(diagram, leg, on)` refuses a Leg that is not 1,1 or not on a binary Association; `setCardinality` drops it when the Cardinality is not 1,1. Additive, no migration ([ADR 0009](../../adr/0009-additive-format-changes-after-v0-1.md)).
- **MLD**: after Inheritances and before Associations, relative Legs are applied strong Entity first (repeated passes; what is left is a cycle). Their Associations are then skipped by the Association loop. The "no Identifier" warning is checked afterwards: a dependent Entity keyed by its foreign key alone does not warn.
- **UML**: `umlLayout` marks the Leg whose peer is relative (`composition`), and `LegEdge` draws a filled diamond at its class end.
- **Glossary**: Relative identifier.

## Testing Decisions

- Model: mark and clear; refused on 0,n, on an N-ary; cleared by a Cardinality change; file round trip and paste.
- MLD: Line keyed by (order_id, number); two relative Legs; a chain of three; a binary FK to a dependent Entity takes its whole key; cycle, N-ary and reflexive warned and ignored.
- MCP: `set_cardinality` with `relative`, errors; `get_diagram`.
- UML layout: composition flag on the right Leg.
- By hand: both Notations, the SQL.

## Out of Scope

Relative identification through an Inheritance child (the child's key comes from its parent).
