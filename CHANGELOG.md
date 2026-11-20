---
title: Changelog
tags: [changelog]
date: 2026-11-20
---

# Changelog

## v0.2.0 — 2026-11-20

Phones and tablets, and MCDs that cover the rest of Merise.

### Added

- Phones: the canvas fills the screen under a one-line header; the palette, the properties and the SQL open as drawers from floating buttons
- Touch screens: tap a palette item then tap the canvas to place it, bigger handles to draw Connections and Legs with a finger, and a long-press menu (Properties, Duplicate, Copy, Cut, Delete; Paste here, Select all)
- Desktop: the palette and the properties fold into thin rails, one by one or both with Cmd/Ctrl+\, remembered per browser
- N-ary Associations: drag between an Association and an Entity to add a Leg; a bubble in Merise, a diamond in UML, always a table in the MLD
- CIFs on N-ary Associations, drawn as in Looping (a constraint in UML), taking the determined Entity out of the table's key
- Inheritance between Entities with X, T or XT constraints, translated into the MLD by reference, push down or push up; generalisations in UML
- Relative identifiers: a 1,1 Leg marked R keys its Entity's table by the other Entity's key first; a composition in UML
- MCP: `add_leg`, `add_cif`, `set_inheritance`, `set_inheritance_options`, `legs` on `add_association` and `relative` on `set_cardinality`

### Fixed

- A malformed entry in a Shared Project (from another version of the app or a faulty client) no longer breaks the app for every Participant: it is left out and a banner counts it
- Stop sharing keeps the Shared Project until the Local copy is read back from storage, so a full device no longer leaves an empty copy
- A line break in an Entity, Association or Diagram name can no longer escape the comments of the PostgreSQL script
- MCP writes no longer report success on an element stored under another key than its id

## v0.1.0 — 2026-11-20

The first public version.

### Added

- Projects stored locally in the browser, each holding System design diagrams and MCDs
- System design diagrams: Components (Service, Client, Database, Disk, Person…) with product Skins, Hosting and Provider badges, a Runtime on Services, Zones grouping Components, Connections with a Flow (Read, Write, Read/Write) and labels, sticky Notes
- MCDs in Merise or UML notation, with Attribute Data types, the derived MLD and a PostgreSQL script
- Canvas: Tidy up with right-angle routes, drop with snapping and guides, selection gestures, trackpad pan and pinch zoom, copy, cut, paste and duplicate through the system clipboard
- Export a Diagram as PNG or SVG, with a Legend for System design diagrams
- Shared Projects: real-time sync by Share link, Participants' avatars, cursors and selections, Stop sharing keeping a Local copy
- An MCP endpoint on `/mcp` so AI agents can read and edit Shared Projects
- A single Docker image serving the app and the sync, with SQLite storage or a public relay mode that keeps nothing on disk, hardened for public deployment
