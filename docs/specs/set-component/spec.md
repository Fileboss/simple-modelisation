---
title: set-component - change a Component's type or place over MCP
tags: [spec]
date: 2026-11-19
status: done
---

# set-component

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Component, Component type, Zone).

## Problem Statement

An agent editing an existing System design diagram cannot change what a Component is, nor where it sits: turning an Object storage into a Disk means deleting it and drawing it again, which loses its id, its Connections and its place, and a new Component always lands where the server puts it.

## Solution

An MCP tool `set_component` changes an existing Component in place: its type, its name, and its place, either at a given position or into a Zone (or out of every Zone). Its id and Connections are kept.

## Implementation Decisions

- **Type change** (a model operation): a Skin the new type does not offer goes back to Generic; a Disk kind goes away when the Component is no longer a Disk; Hosting and Provider stay. No schema change.
- **Place**: `x` and `y` (either alone keeps the other) move it there; `zone` moves it into that Zone, after its content, the Zone growing as for `add_component`; `zone: "none"` moves it next to the others, outside every Zone (a Zone really named "none" wins). Asking for the Zone it is already in moves nothing. A position and a Zone together are refused before anything changes. Moving drops the Component's stored routes, as a drag does.
- **Staying in its Zone**: a new name or type changes the box's estimated size; when nothing moves it, its Zone grows rather than lose it.
- Name changes reuse the rename rules (a blank name is refused by the argument schema).

## Testing Decisions

- Model: a type change keeps or drops the Skin and Disk kind as above.
- MCP integration: change a type keeping Connections, move to a position, into a Zone and out of all Zones; a position with a Zone is refused.

## Out of Scope

Changing a Component's type in the app's panel; moving several Components at once.
