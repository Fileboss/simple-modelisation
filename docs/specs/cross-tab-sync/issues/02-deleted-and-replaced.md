---
title: Deleted or replaced in another tab
tags: [ticket]
date: 2026-11-26
status: done
blocked_by: [1]
---

# Deleted or replaced in another tab

Spec: [cross-tab-sync](../spec.md).

## What to build

The Project page tells a Project that leaves the list while open (the deleted message, a link to the Projects, the document closed without saving again) from one that never existed. Stop sharing announces the Local copy on the channel before the Shared Project is dropped; the other tabs showing it open the copy.

## Acceptance criteria

- [x] Tests: a Project leaving the list while open gives the deleted state; a replacement announced for it gives the copy's id
- [x] By hand: delete in tab A, tab B shows the message, the Project stays gone after reloading both; stop sharing in tab A, tab B opens the copy
