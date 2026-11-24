---
title: Changelog
tags: [changelog]
date: 2026-11-20
---

# Changelog

## v0.4.0 — 2026-11-24

SQL constraints and Areas on MCDs, duplicated Diagrams, and fewer, clearer MCP tools.

### Added

- MCDs: UNIQUE on an Attribute or on a group of them, CHECK as an SQL expression, named foreign keys, and COMMENT ON for Entities, Associations and Attributes, in the panel, the PostgreSQL script and over MCP (`set_entity`, and new fields on `add_entity`, `add_association`, `add_attribute`, `set_attribute`, `set_cardinality`, `set_inheritance`)
- MCDs: Areas, light colored rectangles with an optional label behind the model, at any place and size, left alone by Tidy up; in the images and over MCP (`add_area`, `set_area`)
- Duplicate a Diagram, from its tab, the Diagram menu on phones and over MCP (`duplicate_diagram`)

### Changed

- MCP, breaking: `set_skin`, `set_hosting`, `set_provider`, `set_runtime` and `set_disk_kind` are gone; `set_component` sets them all, and refuses a call that changes nothing
- PostgreSQL scripts name every foreign key (`fk_<table>_<columns>` unless named)
- Projects using Areas or the new Attribute fields need this version: an older one leaves Areas out, refuses a JSON file holding one, and drops UNIQUE, CHECK and comments of an element's Attributes when it edits one of them
- The explanations of the palettes and the properties are hidden behind an i button
- MCP: a batch too big stops on the way and names the operation
- The canvas runs on React Flow 13

### Fixed

- A new Diagram always comes last
- Leaving an in-place edit untouched no longer undoes what someone else wrote meanwhile
- Malformed Attributes on a Note, Zone or CIF of a Shared Project no longer break the Diagram
- MCP: a Zone grows when a Component it holds grows, even one asked to stay in it

## v0.3.0 — 2026-11-24

MCDs as SVG, a better Tidy up, wider Notes, and more for agents over MCP.

### Added

- MCDs export as plain SVG, in Merise or UML, from the app, in the all-diagrams zip and over MCP (`export_diagram`)
- Notes can be made wider or narrower by their sides (120 to 600px), the width kept in every export, in Tidy up and over MCP (`set_note`)
- MCP: `set_attribute` and `remove_attribute` change or remove an Attribute without recreating its Entity
- MCP: `delete_diagram`, and `export_project` for the Project as the app's JSON file
- MCP: `batch`, up to 200 write operations played all or nothing and applied as one change, a later one using what an earlier one created with `{ "$ref": N }`
- MCP: `move_elements` to fix places after a layout

### Changed

- Tidy up lays Diagrams out tighter, places Notes too, and can lay an MCD out from top to bottom

### Fixed

- MCD box borders stay one screen pixel wide when zoomed out, instead of losing pieces on a non-Retina screen

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
