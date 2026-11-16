---
title: '03: Share, join by link and sync status'
tags: [ticket, realtime-sync]
date: 2026-11-16
status: done
blocked_by: [1, 2]
---

# 03: Share, join by link and sync status

Part of [realtime-sync](../spec.md).

**What to build:** the Share button on a Local Project sends it to the server, marks it shared in the list and copies its Share link (`/s/<id>` on the page's origin); on a Shared Project the button copies the link again. Opening a Share link checks the Project exists on the server, adds it to the home list as shared and opens it; an unknown link shows "This shared project does not exist". A Shared Project opens with both the browser storage and the sync provider, so it works offline and merges on reconnect. The header shows Local, Synced or Offline. Removing a Shared Project from the list only removes the local copy.

**Blocked by:** 01, 02

**Status:** done

- [x] Share sends the Project, flags it shared and copies the Share link; the button copies it again later.
- [x] `/s/<id>` joins an existing Shared Project or shows the not-found message, creating nothing.
- [x] Two browsers on the same Shared Project see each other's edits and renames in real time.
- [x] Offline edits merge when the connection returns; undo only reverts local changes.
- [x] The header shows Local, Synced or Offline.
- [x] Removing a Shared Project from the list leaves the server copy intact.
- [x] Verified end to end in two headless browser pages against a running server.
