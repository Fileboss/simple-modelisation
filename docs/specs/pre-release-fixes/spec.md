---
title: pre-release-fixes - fixes from the global review before v0.1
tags: [spec]
date: 2026-11-19
status: done
---

# pre-release-fixes

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Note, Connection, Participant, Shared Project). Follows [relay-limits](../relay-limits/spec.md).

## Problem Statement

A global review before v0.1 found bugs people would meet:

- in Safari, cutting deletes the selection before writing the clipboard, and a refused write is ignored: the elements are gone and the clipboard is empty;
- the Note panel's text field is rebuilt whenever the Note's text changes elsewhere, losing what is being typed;
- Escape while editing a Note on the canvas may save the text instead of cancelling;
- the static server caches `index.html` for a year when its directory path contains `assets`;
- the per-address document limit charges a document to the first address that opened it for as long as anyone has it open, cannot be configured, and at 10 is tight for a team behind one address;
- a creation refusal can erase another client's opening of the same document from the bookkeeping;
- pasted Connections keep raw values and unknown fields from the clipboard text.

## Solution

- **Cut in Safari**: the clipboard is written first; the selection is deleted only once the write succeeded. A failed copy, cut or paste through the fallback says so briefly instead of failing silently.
- **Note panel**: the field follows a remote change only while it is not being edited; while focused, what is typed stays and is saved on blur.
- **Escape on a Note**: cancels the edit, nothing saved.
- **Static cache**: only files under the served directory's own `assets/` are immutable.
- **Documents per address**: a loaded document counts for every address that has it open now (and for the one opening it, while it loads); closing it frees that address's count. The limit is 20 by default and set by `MAX_DOCUMENTS_PER_IP`.
- **Creation refusal**: it only undoes what its own opening recorded.
- **Paste**: pasted elements keep only the fields the app writes, read as reads do (Connections included).

## Implementation Decisions

- The per-address count reads the live connections of loaded documents (their address as recorded at the upgrade), plus openings in progress tagged with their address: no separate bookkeeping to release.
- `MAX_DOCUMENTS_PER_IP` follows `MAX_DOCUMENTS` (positive integer, validated at start); README lists it.
- The clipboard fallback reports through the canvas's existing short notes.
- Paste whitelists node and edge fields per element type, from what the model's own writes set.

## Testing Decisions

- Server tests (prior art: relay-limits): an address that closed a document no longer counts it while others keep it open; the limit is configurable; a refused creation leaves another client's opening counted.
- Static files test: a root under an `assets` directory serves `index.html` with `no-cache`.
- Model tests: a pasted Connection with an unknown Flow and extra fields is stored without them.
- By hand in Chromium: Escape cancels a Note edit; the panel keeps typed text across a remote change. Safari cut by hand when available.

## Out of Scope

Cleanups noted by the review (`edges()` reading nodes again, `pasteable` twice per paste, three bounding-box helpers): BACKLOG.md.
