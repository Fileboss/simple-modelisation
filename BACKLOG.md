---
title: Backlog
tags: [backlog]
---

# Backlog

## In progress

## To do

- SQL generation options (ON DELETE / ON UPDATE, naming) and other databases
- MCP server exposing Diagrams to AI agents
- Grouping zones in System design diagrams (VPC, region)
- Custom Skins
- Ternary Associations, inheritance and CIF in MCDs
- French UI
- Image export (PNG/SVG)
- Stop sharing a Project (back to Local)
- End-to-end tests in CI (Playwright), once the product settles; until then they are run by hand per item
- Canvas performance on large Diagrams: keep unchanged node and edge objects between updates instead of rebuilding them all

## Done

- [uml-notation](docs/specs/uml-notation/): Merise / UML switch per MCD, editable class diagram
- [postgres-sql](docs/specs/postgres-sql/): Attribute Data types, MLD and PostgreSQL script under every MCD
- [live-presence](docs/specs/live-presence/): Participants' avatars, cursors and selections on Shared Projects
- [realtime-sync](docs/specs/realtime-sync/): Shared Projects synced in real time, Share links
- [v1-core](docs/specs/v1-core/): Projects, System design diagrams and MCDs, local only
