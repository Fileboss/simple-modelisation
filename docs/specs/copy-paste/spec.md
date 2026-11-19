---
title: copy-paste - copy, cut, paste and duplicate on the canvas
tags: [spec]
date: 2026-11-19
status: done
---

# copy-paste

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Component, Zone, Connection, Note, Entity, Association, Leg).

## Problem Statement

Drawing three similar Services, or one Zone per region, means dropping and configuring each element again: there is no copy, paste or duplicate on the canvas, which every drawing tool has and users reach for first.

## Solution

- **Cmd/Ctrl+C** copies the selection, **Cmd/Ctrl+X** cuts it (what was copied is removed: a Zone with what it holds), **Cmd/Ctrl+V** pastes, **Cmd/Ctrl+D** duplicates. A copied Zone brings what it holds; the Connections and Legs between copied elements come along, the others not.
- A paste lands centred under the pointer when it is over the canvas, else 24 px below and to the right of where it was copied; a duplicate always 24 px off. What is pasted is selected, and the paste is one undo step.
- Copies go through the system clipboard, so they paste into another Diagram, Project or tab. Elements the target Diagram's kind does not take are left out (an Entity in a System design diagram, a Component in an MCD); Notes go anywhere.
- As the other canvas shortcuts, they act only while the canvas was the last thing clicked and never while typing in a field.

## Implementation Decisions

- **Clip** (`packages/model/src/clipboard.ts`, pure): `copyElements(nodes, edges, ids, kind)` takes the selected nodes, the content of selected Zones (`zoneContent`), and the edges whose two ends are taken, into `{ format: 'simple-modelisation/clip', version: 1, kind, nodes, edges }`. `readClip(text)` parses and validates it like an imported file (same node and edge checks), returning null for anything else.
- **Paste** (`ProjectDocument.paste(diagramId, clip, dx, dy)`): `pasteable` keeps what the Diagram's kind takes, checked as an imported file is and read as the app reads nodes, with no Association left with fewer than two Legs; in one transaction, every element gets a new id, edges are remapped to the new ids and keep their routes shifted by (dx, dy). Returns the new ids, edges included. Clipboard text over 1 MB is not a clip.
- **Canvas**: `copy`, `cut` and `paste` events on the document (no clipboard permission needed): `copy` writes the clip as JSON text, `cut` also deletes what was copied, `paste` reads it. Safari fires none of these without a text selection: when the event has not come by the next task after the key, the Clipboard API (`writeText`, `readText`) does the same. Cmd/Ctrl+D copies and pastes at once, without the clipboard, once per press (not per key repeat). The offset centres the bounding box of what the Diagram takes of the clip on the pointer (its screen position converted when pasting, so a pan meanwhile counts) or shifts it by 24 px. After a paste, the selection becomes what was pasted, Connections included.
- **Gating**: the shortcut check of `selection.ts` extends to C, X, V and D (Cmd/Ctrl only, no other modifier, canvas last clicked, not typing).

## Testing Decisions

- Clip: copies the selection, a Zone's content, internal Connections only; refuses foreign text and malformed clips.
- Paste: fresh ids, remapped edges, shifted routes; foreign-kind nodes dropped with their edges; Notes kept; one undo step.
- Shortcut routing for the new keys.
- By hand: copy, paste under the pointer, cut, duplicate, paste a Zone with content, paste into another Diagram and another tab, an MCD selection into a System design diagram.

## Out of Scope

Paste as text into other apps (the JSON is what lands there); keeping a Component's place in its Zone when pasted elsewhere (geometry decides); pasting images.
