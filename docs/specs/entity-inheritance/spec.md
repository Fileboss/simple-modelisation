---
title: entity-inheritance - parent and child Entities, X / T / XT, three MLD translations
tags: [spec]
date: 2026-11-20
status: done
---

# entity-inheritance

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Entity, Identifier, MLD, Notation). Last of three Merise extensions, after [nary-associations](../nary-associations/spec.md) and [cif-constraints](../cif-constraints/spec.md).

## Problem Statement

Merise models specialise Entities: a Person is a Student or a Teacher, who share the Person's Attributes and Identifier and add their own. Today a modeler fakes it with 1,1 Associations, which says something else and gives a different MLD.

## Solution

An **Inheritance** joins a **parent** Entity to its **child** Entities. It is drawn as in Looping: a triangle under the parent, with its constraint inside, a line up to the parent and a line down to each child.

- **Making one**: in a child Entity's panel, "Inherits from" lists the other Entities (not its own descendants). Choosing a parent puts the child under that parent's Inheritance, made under the parent if it has none; "None" takes it out (an Inheritance left without children is deleted). One parent per Entity; dragging between Entities still makes Associations.
- **Constraint**: in the Inheritance's panel, None, X (exclusion: a parent is at most one child), T (totality: at least one), XT (partition: exactly one). Shown in the triangle.
- **MLD translation**, per Inheritance, in its panel:
  - **By reference** (default, Looping's): each child is a table keyed by a foreign key to its parent's key, with its own Attributes; the parent keeps its table.
  - **Push down**: no parent table; each child table takes the parent's Attributes and Identifier, then its own. An Association to the parent cannot be translated: a warning, and it is left out.
  - **Push up**: no child tables; the parent table takes the children's Attributes (nullable) and a `<parent>_type` column whose CHECK lists the children; NOT NULL with T. Associations to a child go to the parent table.
  - A child's own Identifier is ignored, with a warning: the parent's key identifies it.
  - SQL: what the translation cannot enforce (X or T by reference or push down) is said in a `-- Note:` comment at the top of the script.
- **UML Notation**: a generalisation, a line from each child to the parent with a hollow triangle at the parent; the constraint as `{disjoint}`, `{complete}` or `{disjoint, complete}` beside the triangle. No Merise triangle.
- **Deleting**: deleting the parent deletes its Inheritance; deleting a child takes it out; deleting the Inheritance frees its children.
- **Tidy up**: the Inheritance is laid out after its parent and before its children, in the layout's direction.
- **MCP**: `set_inheritance` (entity, parent or null), `set_inheritance_options` (parent, constraint, translation); `get_diagram` lists Inheritances.

## Implementation Decisions

- **Model**: a node of type `inheritance` in MCDs: `parent` (an Entity id), `constraint` (`none`, `X`, `T`, `XT`; absent for none), `translation` (`reference`, `down`, `up`; absent for reference); x, y. Children are edges of type `isa`, from the Inheritance (source) to each child (target). The line to the parent is drawn, not stored. `setParent(diagram, child, parent | null)`, `setInheritanceConstraint`, `setInheritanceTranslation`. Cycles and a second parent are refused. Additive, no migration ([ADR 0009](../../adr/0009-additive-format-changes-after-v0-1.md)).
- **MLD**: Entities are translated parents first; `Mld` gains `notes` (rendered as `-- Note:` lines); `Column` gains `check` (allowed values). Nested Inheritances compose (a grandchild by reference references its parent's table).
- **Canvas**: an `InheritanceNode` (triangle), `isa` edges as plain lines, a derived line to the parent; in UML the node is hidden, `isa` edges become generalisations to the parent.
- **Glossary**: Inheritance, parent and child Entity.

## Testing Decisions

- Model: `setParent` makes and shares the Inheritance, moves a child, "None" deletes an empty Inheritance; cycles and self refused; cascades on deleting parent, child, Inheritance; paste and file round trip.
- MLD: by reference (child keyed by a foreign key to the parent; nested); push down (parent Attributes copied, Association to the parent warned); push up (child Attributes nullable, type column with CHECK, NOT NULL with T, Association to a child redirected); child Identifier warned; notes for X / T.
- MCP: `set_inheritance`, `set_inheritance_options`, `get_diagram`.
- Layout: UML generalisations; Tidy up ranks parent, Inheritance, children in order.
- By hand: both Notations, each translation's SQL, delete each part.

## Out of Scope

Multiple inheritance; inheritance between Associations; choosing the type column's name.
