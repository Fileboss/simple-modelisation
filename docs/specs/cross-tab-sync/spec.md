---
title: cross-tab-sync - Browser tabs kept in step with each other
tags: [spec, storage]
date: 2026-11-26
status: done
---

# cross-tab-sync

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Project, Local Project, Shared Project). Storage: [ADR 0001](../../adr/0001-yjs-document-model.md).

## Problem Statement

Every browser tab loads its own copy of the Project list and of the open Project from IndexedDB, and nothing passes edits between tabs. With one Project open in two tabs, the tabs drift apart until they are reloaded. A Project created, renamed, shared or deleted in one tab does not show in another. A Project deleted in one tab can come back, empty, if another tab still has it open and writes to it.

## Solution

The tabs of one browser pass their Yjs updates to each other, so a Project open in two tabs behaves as it does for two Participants of a Shared Project: each edit appears in the other tab right away. This covers the Project list and every open Project, Local or Shared. Nothing leaves the device and nothing changes in the stored format.

- **Transport:** one `BroadcastChannel` for the app. Each Yjs document opened through `src/storage/persistence.ts` (the Project list, a Project, a Project opened briefly to rename it) joins it under its IndexedDB name. It sends its local updates and applies the ones it receives with its own origin, so they never enter the undo history. One channel keeps a tab's messages in the order it sent them.
- **Catching up:** a tab that opens a document sends its state vector. Tabs that already hold the document answer with what it is missing, covering updates IndexedDB has not written yet.
- **Deleted in another tab:** a tab showing a Project that leaves the list while it is open shows "This project was deleted in another tab." with a link back to the Projects. It stops saving that Project: its document is closed without writing again.
- **Stop sharing in another tab:** before dropping the Shared Project, the tab that stops sharing announces, on the channel and without storing anything, which Local copy replaces it. The other tabs showing that Project open the copy, as the tab that stopped sharing does.
- **Sharing in another tab:** once the list says the Project is shared, the other tabs showing it connect to the sync too, as they would after a reload.

## Acceptance Criteria

- [x] An edit in a Project open in two tabs shows in the other tab without a reload, both ways, for a Local and for a Shared Project.
- [x] Undo in a tab undoes only that tab's own edits.
- [x] A Project created, imported, renamed (from its page or from the list), shared or deleted in one tab shows in the list of every other tab.
- [x] A Project deleted in tab A while open in tab B: tab B shows the deleted message, and the Project stays gone from the list and from IndexedDB after both tabs reload.
- [x] Stop sharing in tab A while tab B shows the Project: tab B opens the Local copy, and the Shared Project is gone from the list.
- [x] A tab opened after another tab's edit sees that edit, even if IndexedDB has not written it yet.
- [x] Without `BroadcastChannel` the app works as before, tab by tab.

## Out of Scope

- Presence between tabs: a Shared Project open in two tabs still shows the same person twice.
- Coordinating two different browsers, or two browser profiles: they share no storage.
- Electing one tab to hold the sync connection of a Shared Project; each tab keeps its own.

## Further Notes

- No new dependency: `BroadcastChannel` is in every supported browser, and the Yjs sync messages are a state vector and an update.
- The e2e check is done by hand with two tabs, as for other items.
