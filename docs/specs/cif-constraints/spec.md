---
title: cif-constraints - functional integrity constraints on N-ary Associations
tags: [spec]
date: 2026-11-20
status: done
---

# cif-constraints

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (N-ary Association, Leg, Cardinality, MLD, Notation). Second of three Merise extensions, after [nary-associations](../nary-associations/spec.md).

## Problem Statement

An N-ary Association becomes a table keyed by all its foreign keys. Often one Entity is fixed by the others: in "teaches" (Teacher, Class, Subject), a Class and a Subject give one Teacher. The key should then be (class, subject), with the teacher as a plain NOT NULL column. Merise expresses this with a CIF; today the MLD is wrong and only a warning hints at it.

## Solution

A **CIF** is a small circle marked "CIF" next to an N-ary Association: lines join it to the Entities of its **determinant** Legs, and an arrow points from it to the Entity of its **determined** Leg ({Class, Subject} → Teacher).

- **Making one**: select an N-ary Association, "+ CIF" in its panel. The new CIF determines the Leg with a max of 1 if there is one, else the last Leg, by all the others; it sits above the Association.
- **Editing**: the CIF's panel lists its Association's Legs, each Determinant, Determined or Not involved (exactly one Determined, at least one Determinant). A partial CIF ({A, B} → C in a 4-ary) is allowed.
- **Deleting**: like any element. Deleting its Association deletes it; deleting its determined Leg deletes it; deleting a determinant Leg removes it from the CIF (a CIF left without determinant is deleted).
- **MLD**: the Association's table is keyed by the foreign keys of its Legs that no CIF determines; a determined Leg's foreign key is a NOT NULL column outside the key. A Leg with a max of 1 that a CIF determines no longer warns; one no CIF determines still warns ("add a CIF"). A CIF on an Association that is binary again is ignored, with a warning.
- **UML Notation**: no circle; the diamond shows the constraint as text under its name, `{class, subject → teacher}`.
- **Tidy up**: CIFs are left out of the layout and put back above their Association.
- **MCP**: `add_cif` (association, determinants and determined, each an Entity name or a Leg id), `get_diagram` lists CIFs, `delete_elements` deletes them.

## Implementation Decisions

- **Model**: a node of type `cif` in MCDs: `association` (its id), `determinants` (Leg ids), `determined` (a Leg id); x, y. Legs rather than Entities, so that an Entity on two Legs stays unambiguous. `addCif(diagram, association)`, `setCifRole(diagram, cif, leg, 'determinant' | 'determined' | 'none')`. Additive format change, no migration ([ADR 0009](../../adr/0009-additive-format-changes-after-v0-1.md)); Leg ids that are not the Association's are ignored when drawing and deriving.
- **Lines**: not stored. The MCD layout adds, for each CIF, a line to each determinant Entity and an arrow to the determined one (edges of type `cifLink`, neither selectable nor deletable), and hides CIFs and their lines in UML.
- **MLD**: in `deriveMld`, an N-ary table's key leaves out determined Legs; their columns are NOT NULL.
- **Glossary**: CIF.

## Testing Decisions

- Model: `addCif` on a ternary picks the max-1 Leg, else the last; refused on a binary; roles change with exactly one determined; cascades on deleting the Association, the determined Leg, a determinant Leg; file round trip.
- MLD: ternary with a CIF keyed by two foreign keys, the third NOT NULL; partial CIF on a 4-ary; max-1 warning gone when determined; CIF on a binary ignored with a warning.
- MCP: `add_cif` by Entity names and by Leg ids, `get_diagram` lists it, errors.
- Layout: lines for a CIF in Merise, none in UML; the UML constraint text.
- By hand: add, edit, delete a CIF in both Notations, Tidy up, read the SQL.

## Out of Scope

CIFs on binary Associations (a max of 1 says it); other inter-Association constraints (inclusion, exclusion, totality between Associations).
