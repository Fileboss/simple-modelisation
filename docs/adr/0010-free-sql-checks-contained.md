---
title: Checks are free SQL, contained but not parsed
tags: [adr]
date: 2026-11-24
status: accepted
---

# Checks are free SQL, contained but not parsed

An Attribute's Check could be structured (allowed values, a minimum, a maximum) or free SQL. We chose **free SQL**: it covers patterns, functions and comparisons between columns, which a structure would never finish covering.

Any Participant or agent of a Shared Project can write it, and the script is pasted into real databases. So a Check is scanned, not parsed: it is refused when its text could end the `CHECK (...)` it is written in (parentheses, quotes, `;`, comments, dollar quotes, escapes). The scan runs on writing and again on reading, since a file or a peer can write anything.

> [!warning] What this does not do
> A contained expression can still be wrong SQL, or call a function of the database when rows are written. A script from a Project shared with people you do not trust is to be read before it is run.

The fields are added to Attributes ([ADR 0009](0009-additive-format-changes-after-v0-1.md)): an app older than this one rewrites an element's whole Attribute list when it edits one, and drops these fields from that element as it does.
