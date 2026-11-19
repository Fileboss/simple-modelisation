---
title: No data migration before the first release
tags: [adr]
date: 2026-11-19
status: accepted
---

# No data migration before the first release

Until the first version is published (the first `vX.Y.Z` tag), changes to the Project document's format (a new node type such as Person or Note, a removed Skin, a new field) come without a migration, and without keeping older versions of the app able to read the new files. The only Projects that exist are the developer's own: after such a change is merged, the local data is wiped (the sync server's `server/data/documents.sqlite`, and the browser's local Projects if needed) rather than migrated. Writing migrations now would be spent on data nobody keeps, and would freeze a format still being found. From the first release on, a format change needs a migration or a reading that stays compatible, decided item by item, since Projects then live on servers and in browsers we do not control. Values a version does not know are already read as unspecified (a Skin as Generic, a Hosting as none), which softens most changes but does not let an older version read a new node type.
