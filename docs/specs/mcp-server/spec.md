---
title: mcp-server - AI agents read and edit Shared Projects
tags: [spec]
date: 2026-11-16
status: done
---

# mcp-server

Vocabulary: [GLOSSARY](../../../GLOSSARY.md). Decisions: [ADR 0003](../../adr/0003-hocuspocus-single-node-server.md), [ADR 0004](../../adr/0004-shared-model-package.md).

## Problem Statement

A developer working with an AI agent (Claude Code…) cannot let it look at or draw their architecture and data model: the agent has no way into the app, so diagrams and code drift apart.

## Solution

The sync server exposes an MCP endpoint (`/mcp`, Streamable HTTP). Given a Shared Project's Share link, an agent reads its Diagrams (and an MCD's MLD and PostgreSQL script) and edits them: Diagrams, Components, Connections, Skins, Entities, typed Attributes, Associations, Cardinalities, renames and deletions. Its changes go through the sync, so everyone with the Project open sees them live, like a collaborator's. Local Projects stay out of reach.

## User Stories

1. As a developer, I want to add the app's MCP server to my agent with one command, so that it can work on my diagrams.
2. As a developer, I want my agent to read a Shared Project from its Share link, so that it understands my architecture and data model.
3. As a developer, I want my agent to get an MCD's MLD and SQL, so that it can write migrations or code from it.
4. As a developer, I want my agent to add and change elements (Diagrams, Components, Connections, Skins, Entities, Attributes, Associations, Cardinalities) and rename or delete them, so that it keeps diagrams in step with the code.
5. As a developer, I want what my agent adds placed automatically next to the existing elements, so that the Diagram stays readable.
6. As a developer, I want to name elements as I see them (or by id), with an error listing the candidates when a name is ambiguous, so that the agent addresses the right one.
7. As a Participant, I want an agent's edits to appear live like a collaborator's, without my undo reverting them, so that I keep control of my own changes.
8. As an operator, I want the endpoint to reach only Shared Projects by their link, never list or create them, and to be rate limited, so that an open server stays safe.

## Implementation Decisions

- **Shared model package** (ADR 0004): the Project document and SQL modules move to `packages/model`, imported by the app and the server.
- **Endpoint**: `/mcp` on the sync server, MCP Streamable HTTP via the official SDK, stateless. Tools take a `project` argument: a Share link or a Project id (UUID); the Project must exist on the server. No tool lists or creates Projects.
- **Edits** go through a Hocuspocus direct connection on the Project's document, as one transaction per tool call, so connected clients receive them as remote changes (their undo ignores them) and they are stored like any other change.
- **Tools** — read: `get_project` (name, Diagrams), `get_diagram` (elements in a readable form with ids), `get_mcd_sql` (MLD text and PostgreSQL script); write: `add_diagram`, `add_component`, `connect_components`, `set_skin`, `add_entity`, `add_attribute`, `add_association`, `set_cardinality`, `rename_element`, `delete_elements`. Inputs are validated (component types, Skin ids from the catalog, Data types, Cardinalities).
- **References**: an element is given by id or exact name; an ambiguous or unknown name is an error listing the matching ids or the available names.
- **Placement**: new elements go on a grid next to the existing ones (to the right of the rightmost, wrapping below), never on top of another.
- **Guards**: per-IP rate limit on `/mcp` requests; the document size limit applies to agent edits too.

## Testing Decisions

- Model package: existing tests move with it, unchanged.
- Integration tests with the SDK's MCP client against the running server: read a Project; an agent's add appears in a Yjs client connected to the same Project; references by name and ambiguity errors; an unknown link and a non-UUID are refused; no tool lists Projects.
- By hand: Claude Code connected to the local server edits a Diagram open in the browser.

## Out of Scope

Local Projects; creating, listing or deleting Projects; authentication beyond the Share link; MCP resources and prompts; layout of existing elements.
