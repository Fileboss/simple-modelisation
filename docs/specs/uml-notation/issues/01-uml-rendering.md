---
title: '01: UML rendering of an MCD'
tags: [ticket, uml-notation]
date: 2026-11-16
status: done
blocked_by: []
---

# 01: UML rendering of an MCD

Part of [uml-notation](../spec.md).

**What to build:** a Merise / UML toggle in the MCD palette, remembered per MCD in the browser. In UML, Entities render as classes with `name : Type {id}` / `[0..1]` lines; each Association renders as its name label between its classes (beside the class when reflexive) with UML multiplicities near each class, the other Leg's Cardinality converted; an Association with Attributes adds an association-class box with a dashed link. Clicking a multiplicity cycles the matching Leg; every other gesture works as in Merise.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Toggle switches the Notation and is remembered per MCD per browser; collaborators keep their own.
- [x] Classes, lines, names, multiplicities, association classes and reflexive loops render in UML.
- [x] Multiplicity click cycles the right Leg; add, rename, connect and the panel work in UML.
- [x] Tests: multiplicities, Attribute lines, UML layout.
- [x] Verified by hand in the browser.
