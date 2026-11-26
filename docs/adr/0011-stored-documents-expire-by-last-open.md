---
title: Stored documents expire by last open, opt-in
tags: [adr]
date: 2026-11-26
status: accepted
---

# Stored documents expire by last open, opt-in

A server with storage keeps every Shared Project it was given. Its operator may now set `EXPIRY_DAYS`: a document nobody has opened for that long is deleted. The clock is the **last open** (loaded by a Participant or an agent, or leaving memory), not the last edit, so a Project that is only read stays. It is off by default: on a private server, losing a Project nobody opened for a year is worse than the disk it takes.

The `documents` table gains a `last_opened_at` column, added at start when missing and filled from `updated_at`. An older server ignores it, so going back a version is safe.

## Considered Options

- By last edit (`updated_at`, no schema change): a reference diagram read every week but never changed would expire.
- No expiry, only the size cap: a public server with storage fills up for good once the cap is reached.

## Consequences

Nothing is lost while a Participant keeps the Project in their browser: their next open shares it again. Anyone who only has the Share link loses it.
