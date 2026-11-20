---
title: Additive format changes after v0.1, without migration
tags: [adr]
date: 2026-11-20
status: accepted
---

# Additive format changes after v0.1, without migration

[ADR 0008](0008-no-migration-before-first-release.md) said that once v0.1.0 is out, a change to the Project document's format needs a migration or a compatible reading, decided item by item. For the Merise extensions (N-ary Associations, CIFs, inheritance) we decided: **changes that only add** (a new node or edge type, a new optional field, more Legs on an Association) **come without a migration and without a format version bump**. Existing Projects stay valid as they are; nothing is rewritten.

The cost is on older apps: a v0.1.0 app opening a Project that uses the additions ignores or mis-draws what it does not know (an N-ary Association's MLD from its first two Legs, an unknown node type). We accept it while few people run v0.1.0, rather than bumping `FILE_VERSION` and refusing files, which would not protect a Shared Project open in two versions at once anyway.

A change that removes, renames or reinterprets something stored still needs a migration, decided in its own item.
