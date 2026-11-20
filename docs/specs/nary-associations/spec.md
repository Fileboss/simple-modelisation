---
title: nary-associations - Associations between three Entities or more
tags: [spec]
date: 2026-11-20
status: done
---

# nary-associations

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (MCD, Entity, Association, Leg, Cardinality, MLD, Notation). First of three Merise extensions; CIFs and inheritance follow as their own items.

## Problem Statement

An Association joins exactly two Entities. Merise models often need more: a Course is given by a Teacher in a Room on a Slot, a Supplier delivers a Product to a Warehouse. Today the only way out is a fake Entity standing for the Association, which is not Merise and gives a different MLD.

## Solution

An **N-ary Association** has three Legs or more, each to an Entity (the same Entity may appear on several Legs).

- **Making one**: drag from an Association to an Entity (or from an Entity to an Association) to add a Leg, with a 0,n Cardinality. Dragging from an Entity to an Entity still makes a new binary Association. Deleting a Leg of a ternary makes it binary again; an Association left with fewer than two Legs is deleted, as today.
- **Merise Notation**: the Association bubble with one Leg per Entity, each labelled with its Cardinality, as binary ones are drawn.
- **UML Notation**: a diamond, placed where the Association is stored and draggable, joined by a line to each class with the Leg's multiplicity at the class end; the Association's name beside the diamond and its Attributes in an association class joined to the diamond by a dashed line. Binary Associations keep today's UML drawing.
- **MLD**: an N-ary Association always becomes a table named after it, keyed by the foreign keys to all its Entities, with its Attributes as columns. A Leg with a max of 1 on an N-ary Association gets a warning: a functional dependency that a CIF (next item) will express; its foreign key stays in the key until then.
- **MCP**: `add_association` takes `legs` (two or more `{ entity, cardinality }`); `from` and `to` stay accepted for a binary one. A new `add_leg` adds a Leg to an existing Association. `get_diagram` already lists every Leg.

## Implementation Decisions

- **Model**: no new type. `addAssociation` keeps making binary ones; a new `addLeg(diagram, association, entity)` adds a 0,n Leg and refuses anything but an Association and an Entity. Reading accepts Associations with any number of Legs (it already does).
- **Data format**: an addition, no migration ([ADR 0009](../../adr/0009-additive-format-changes-after-v0-1.md)). A v0.1.0 app opening a ternary shows its three Legs (Merise drawing is per Leg) but derives the MLD from the first two.
- **Canvas**: the Association node gets connectable handles; `mcdKind.connect` adds a Leg when one end is an Association, an Association otherwise; connecting an Association to an Association, or to a Note, is refused.
- **UML layout**: `umlLayout` keeps binary Associations as they are; an N-ary one keeps its stored position, is drawn as a diamond (`umlNary` on its data) and its Legs carry their own Cardinality as multiplicity instead of a peer's.
- **MLD**: in `deriveMld`, an Association with three Legs or more takes the table path whatever the Cardinalities; foreign key columns are named as today (`entity_key`, then `_association` and a number for repeats). Warning text: `Association "X" joins N Entities with a max of 1 on Y: a CIF will take it out of the key.`
- **Tidy up**: ELK already lays out an Association node with any number of Legs; checked, not changed.

## Testing Decisions

- Model: `addLeg` adds a 0,n Leg; refuses a non-Entity target or a non-Association source; deleting one Leg of a ternary leaves a binary; file round trip keeps the three Legs.
- MLD: a ternary becomes a table keyed by three foreign keys with its Attributes; the same Entity twice gets two distinct columns; a max-1 Leg warns.
- MCP: `add_association` with three `legs`; `from`/`to` still work; `add_leg`; errors for unknown names.
- UML: the layout leaves an N-ary Association where stored and gives each Leg its own multiplicity.
- By hand: drag to add a Leg in both Notations, Tidy up a ternary, read its MLD and SQL, delete a Leg.

## Out of Scope

CIFs (next item) and inheritance (the one after). Choosing which Legs form the key by hand. Removing a Leg from the panel (delete it on the canvas).
