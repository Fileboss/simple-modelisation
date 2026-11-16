---
title: live-presence - who is on a Shared Project, their cursors and selections
tags: [spec]
date: 2026-11-16
status: done
---

# live-presence

Vocabulary: [GLOSSARY](../../../GLOSSARY.md). Builds on [realtime-sync](../realtime-sync/spec.md).

## Problem Statement

On a Shared Project, changes from others appear out of nowhere: nobody can tell who else is there, where they are working, or that two people are about to edit the same Entity.

## Solution

Every Participant of a Shared Project sees the others: avatars in the Project header (initials on their color, their name and Diagram on hover), and, on the Diagram they share, each other's cursor with a name tag and an outline in their color around what they selected. Each browser picks a random display name and color once and keeps them; a Participant renames themselves by clicking their own avatar. Presence is only exchanged, never stored, and Local Projects have none.

## User Stories

1. As a Participant, I want avatars of everyone connected in the Project header, so that I know who is there.
2. As a Participant, I want to see on hover which Diagram each one is on, so that I know where they work.
3. As a Participant, I want the cursors of the Participants on my Diagram, with their name, so that I can follow what they point at.
4. As a Participant, I want what others selected outlined in their color, so that I avoid editing the same element at the same time.
5. As a Participant, I want a name and color without signing up, kept between visits, so that others recognise me.
6. As a Participant, I want to change my display name from my avatar, so that colleagues know it is me.
7. As a Participant, I want a cursor to vanish when its owner leaves the canvas, is idle for 30 s or disconnects, so that stale cursors do not mislead me.
8. As a developer, I want no Presence on a Local Project and nothing about Presence stored, so that sharing a Project shares only its content.

## Implementation Decisions

- **Identity**: a display name drawn from two word lists (adjective + animal) and a color from a fixed palette readable on both canvas kinds, generated once and kept in browser storage; renaming is trimmed and capped (32 characters), a blank name keeps the previous one.
- **Presence** travels through the sync provider's awareness (Yjs awareness, built into Hocuspocus), so nothing reaches the document or the server's storage. A Participant's state: name, color, open Diagram id, cursor in canvas coordinates (or none), selected element ids.
- **Presence module** (client): owns the local identity and turns awareness into a list of other Participants; the UI reads Participants and reports its own Diagram, cursor and selection through it. Cursor updates are throttled to about 20 per second; a cursor is hidden after 30 s without movement or when the pointer leaves the canvas.
- **Avatars** in the Project header, own avatar first and editable; others sorted by name. **Cursors** are drawn in canvas coordinates, so they stay on the right element when zooming or panning. **Selections** outline the selected nodes and edges in the Participant's color.
- Only Shared Projects connect a provider, so Local Projects have no Presence.

## Testing Decisions

- Presence module: a generated identity is reused, renaming rules, awareness states of others turned into Participants (own state excluded, incomplete states ignored).
- Server integration: two real clients through the sync server; one's Presence reaches the other and disappears when it disconnects.
- End to end: two headless browsers on a Shared Project see each other's avatar, cursor and selection. Run by hand during the item, not in CI yet (see BACKLOG: end-to-end tests in CI).

## Out of Scope

Following a Participant (jumping to their Diagram); chat or comments; Presence on Local Projects; accounts.
