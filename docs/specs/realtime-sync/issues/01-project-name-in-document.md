---
title: '01: Project name in the Project document'
tags: [ticket, realtime-sync]
date: 2026-11-16
status: done
blocked_by: []
---

# 01: Project name in the Project document

Part of [realtime-sync](../spec.md).

**What to build:** the Project's name lives in its Project document, so it will travel with a Shared Project. Renaming from the home page or the Project header writes it to the document; the Project list keeps a cached copy for display and refreshes it whenever the open document's name changes. A Project created before this change gets its name copied from the list into the document the first time it opens. The Project list entries gain a `shared` flag (false for now).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The Project document exposes the name and a rename operation (undoable like any other operation).
- [x] Renaming a Project from the home page or the Project header updates the document and the list.
- [x] An existing Project without a name in its document gets the list's name on first open.
- [x] Export writes the document's name; import puts it in the document.
- [x] Tests: name read and rename through the Project document, migration of a missing name.
