---
title: Changelog
tags: [changelog]
date: 2026-11-20
---

# Changelog

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
