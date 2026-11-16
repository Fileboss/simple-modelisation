---
title: uml-notation - an MCD shown as a UML class diagram
tags: [spec]
date: 2026-11-16
status: done
---

# uml-notation

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Notation). Same model as the Merise rendering; only the drawing changes.

## Problem Statement

Many developers read class diagrams, not Merise: an MCD drawn the Looping way is foreign to them, while the model behind it is the same.

## Solution

Each person can switch an MCD between the Merise and UML Notations. In UML, Entities are classes listing `name : Type`, a binary Association is a line between its classes with its name in the middle and a multiplicity at each end, an Association with Attributes adds an association class linked by a dashed line, and a reflexive Association loops on its class. Everything stays editable with the same gestures; the MLD / SQL panel is unchanged.

## User Stories

1. As a developer, I want to switch an MCD to UML, so that I read it as a class diagram.
2. As a developer, I want my choice remembered for that MCD in my browser, without changing what my collaborators see, so that each of us reads it our way.
3. As a developer, I want classes listing `name : Type`, with `{id}` on Identifiers and `[0..1]` on Optional Attributes, so that I see the types.
4. As a developer, I want each Association as a line with its name and UML multiplicities (0..1, 1, 0.._, 1.._) at the right ends, so that I read it the UML way.
5. As a developer, I want an Association with Attributes shown as an association class, so that its data stays visible.
6. As a developer, I want to edit in UML exactly as in Merise (add, rename, connect, click a multiplicity, panel), so that I never switch back to edit.

## Implementation Decisions

- **Notation** is a per-browser preference per MCD (browser storage), not stored in the Project document; default Merise. A toggle in the MCD palette switches it.
- **Multiplicities**: the Merise Cardinality of a Leg shows at the end of the other class: 0,1 → `0..1`, 1,1 → `1`, 0,n → `0..*`, 1,n → `1..*`. Clicking a multiplicity cycles that Leg's Cardinality.
- **Associations in UML** are drawn as their name label placed between their two classes (beside the class for a reflexive one), so the two Legs form the line through it; the label is not dragged (its stored position is kept for Merise). An Association with Attributes shows them in an association-class box above the label, joined by a dashed line.
- **Classes**: white box, bold name, a compartment of `name : Type {id}` / `name : Type [0..1]` lines; types use the Data type names (`Text(120)`, `Decimal(10,2)`).
- The canvas gets a per-kind layout step that adjusts displayed positions and edge data before drawing; the System design kind leaves them unchanged.

## Testing Decisions

- Unit tests: Cardinality → multiplicity, Attribute lines, the UML layout (label between the classes, beside the class for a reflexive Association, peer multiplicity on each Leg).
- End to end by hand: switch to UML, see classes, lines, multiplicities, association class; edit a multiplicity and an Attribute in UML; the choice survives a reload and does not reach a collaborator.

## Out of Scope

Generalisation (inheritance), aggregation and composition, visibility markers, methods, n-ary Associations, a Notation stored in the document.
