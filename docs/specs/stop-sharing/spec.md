---
title: stop-sharing - a Shared Project back to Local on this device
tags: [spec]
date: 2026-11-18
status: done
---

# stop-sharing

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Shared Project, Local Project, Share link).

## Problem Statement

Once a Project is shared, there is no way back: it keeps syncing, and whoever holds the Share link sees every later change. A developer who wants to carry on privately has to export and re-import it by hand.

## Solution

A Shared Project shows a "Stop sharing" button in its header. After an inline confirmation, this device keeps a Local copy of the whole Project (every Diagram, and changes the server has not received yet) under a new id, opens it, and drops the Shared Project from its list. The Shared Project itself is untouched: others keep it and its link, but receive nothing more from this device. Sharing the copy again gives a new link, so holders of the old one never see what was done in private.

## Implementation Decisions

- **No revocation**: a Shared Project has no owner, every link holder has the same rights, and any browser holding a copy recreates it on the server; ending the Share link for everyone needs an owner (backlog).
- **A copy under a new id**, not the same document marked Local: with the same id, sharing again would hand old link holders everything done in between.
- The copy is the document's full state, taken once its new browser storage is open, so every change made until then is in it; a failed copy is cleared. Its undo history starts empty. The Shared Project's entry and browser copy are dropped once its page has closed, as when a Shared Project is removed from the list.
- **Confirmation** inline in the header, as the home page confirms deletions: "Stop sharing on this device? You keep a local copy; others keep the shared Project."

## Testing Decisions

- Registry: a Local copy is listed with the Project's name and creation date, the Shared entry untouched until the page has moved on.
- By hand in the browser: share, stop sharing, check the Local status, the new URL, the content, the list, and that a second browser on the old link keeps the Project and stops receiving edits.

## Out of Scope

Revoking a Share link for everyone; owners and permissions.
