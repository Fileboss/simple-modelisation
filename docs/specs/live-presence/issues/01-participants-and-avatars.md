---
title: '01: Participants and avatars'
tags: [ticket, live-presence]
date: 2026-11-16
status: done
blocked_by: []
---

# 01: Participants and avatars

Part of [live-presence](../spec.md).

**What to build:** each browser gets a random display name and color, kept between visits. On a Shared Project, the Participant shares them with the Diagram they are on through the sync provider's awareness; the Project header shows the avatars of everyone connected (own avatar first, others by name), with name and Diagram on hover. Clicking one's own avatar renames oneself.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A generated identity is reused on the next visit; renaming is trimmed, capped at 32 characters, blank ignored.
- [x] Avatars appear and disappear as Participants connect and leave; hover shows name and Diagram.
- [x] Own avatar renames oneself; others see the new name.
- [x] Local Projects show no avatars.
- [x] Tests: identity reuse and renaming; awareness turned into Participants; server integration with two clients (Presence arrives, then leaves on disconnect).
