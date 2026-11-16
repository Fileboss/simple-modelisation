---
title: postgres-sql - MLD and PostgreSQL script from an MCD
tags: [spec]
date: 2026-11-16
status: done
---

# postgres-sql

Vocabulary: [GLOSSARY](../../../GLOSSARY.md). Derivation rules after Rollercoaster's `mld.rs` (Looping), without inheritance, CIF or n-ary Associations.

## Problem Statement

An MCD stops at the concept: to create the database, the developer still has to derive the tables by hand, apply the Merise rules for each Association and write the SQL, and redo it whenever the MCD changes.

## Solution

Attributes get a Data type and can be marked Optional. Under every MCD, a collapsible panel shows the MLD in Looping's notation and the PostgreSQL script, both updated live as the MCD changes, each with Copy and Download. Problems in the MCD (an Entity without Identifier, two tables with the same name) are listed as warnings above the output and repeated as SQL comments; the script is generated anyway.

## User Stories

1. As a developer, I want to give each Attribute a Data type, so that the generated columns have the right types.
2. As a developer, I want to mark an Attribute Optional, so that its column accepts NULL.
3. As a developer, I want my existing MCDs to keep working, with sensible types filled in, so that I do not retype everything.
4. As a developer, I want the MLD of my MCD under it, in Looping's notation with primary keys underlined, so that I check the relational model at a glance.
5. As a developer, I want the PostgreSQL script under my MCD, so that I can create the database directly.
6. As a developer, I want both to update as I edit the MCD, so that they never go stale.
7. As a developer, I want to copy or download the MLD (.txt) and the script (.sql), so that I can use them elsewhere.
8. As a developer, I want to collapse the panel, so that it does not take room while I draw.
9. As a developer, I want warnings for an Entity without Identifier or duplicate table names, so that I fix the MCD rather than the SQL.
10. As a developer, I want the Merise rules applied for me (foreign keys for x,1 Legs, association tables for n-n, UNIQUE for 1-1, reflexive Associations), so that the model is correct.

## Implementation Decisions

- **Data types** (data schema change, approved): an Attribute gains `type` and `optional`. Types: Integer, Big integer, Decimal(p,s), Text, Text(n), Boolean, Date, Date time, UUID, Auto-increment; Decimal and Text(n) carry their parameters. PostgreSQL mapping: INTEGER, BIGINT, NUMERIC(p,s), TEXT, VARCHAR(n), BOOLEAN, DATE, TIMESTAMP, UUID, SERIAL (a foreign key to a SERIAL column is INTEGER). Old Attributes are completed when read, never rewritten in place (a rewrite on open could race a collaborator's edits on a Shared Project): an Identifier alone in its Entity reads as Auto-increment, every other Attribute as Text, all required; the first edit of an Attribute list stores the completed values, and an import stores them. Identifiers and Auto-increment Attributes are always required.
- **MLD derivation** (pure module, MCD → tables): every Entity is a table keyed by its Identifier (composite allowed). A binary Association with a Leg of max 1 has no table: the Entity on that side takes a foreign key to the other Entity's key (NOT NULL when 1,1) and the Association's Attributes; when both Legs have max 1, the key goes to the 1,1 side (the second Entity when tied) with UNIQUE. Any other Association (both max n) becomes a table keyed by both foreign keys, followed by its Attributes.
- **Naming**: snake_case without accents; a foreign key column is `<referenced table>_<column>`; a column that would duplicate another in its table takes the Association's name as suffix (reflexive Associations); PostgreSQL reserved words are quoted.
- **Order**: tables referenced first, association tables last; circular references (two 1,1 sides) are emitted with their foreign keys added by `ALTER TABLE` after the tables.
- **Warnings**: Entity without Identifier (its table has no primary key), duplicate table names; shown above the output and as `--` comments at the top of the script.
- **MLD text**: `table = (column TYPE, …, #foreign_key*);` one line per table; primary key columns underlined on screen, plain in the copied text; `#` marks a foreign key, `*` an optional one.
- **Panel**: a collapsible panel under the MCD canvas with MLD and SQL tabs, Copy and Download (`<diagram>.txt`, `<diagram>.sql`); collapsed state remembered per browser.
- No `ON DELETE` options; PostgreSQL's default applies.

## Testing Decisions

- Unit tests on the derivation and the script, from MCDs built through the Project document: Entity with composite Identifier; 1-n; n-n with Attributes; 1-1 (0,1/1,1 and 1,1/1,1); Attributes on a 1,1 Leg's Association; reflexive 1-n and n-n; two Associations between the same Entities; Entity without Identifier; reserved word; migration of old Attributes.
- The scripts of those cases run by hand against a real PostgreSQL (Docker) during the item, not in CI.

## Out of Scope

Other SQL targets; ON DELETE / ON UPDATE options; naming options; SQL → MCD reverse engineering; inheritance, CIF, n-ary Associations.
