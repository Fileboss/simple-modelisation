---
title: notes - sticky Notes on the canvas, in five colors
tags: [spec]
date: 2026-11-19
status: accepted
---

# notes

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Diagram, Zone, Tidy up).

## Problem Statement

A diagram cannot say what its boxes do not: that a sync runs every night at 2 a.m., that a database holds personal data, that a service is being replaced. Readers outside the team need those sentences, and today they go in a Connection label or a Component name, where they do not belong.

## Solution

A **Note**: free text on a sticky note, placed anywhere on a System design diagram or an MCD. It is a pale paper square with a slight shadow, in one of five colors (yellow by default, pink, green, blue, purple), its text written on several lines and wrapped; it grows with its text. It is not part of the system: it has no Connections, Tidy up leaves it where it is (or, in a Zone, keeps it in the Zone), and the MLD and SQL ignore it. Like any element it can be moved, snapped, selected and deleted, and a Zone carries the Notes drawn inside it.

## Implementation Decisions

- **Model**: a node of type `note` in either kind of Diagram: `text` (may be empty, trimmed of trailing blank lines) and `color` (one of `NOTE_COLORS = ['yellow', 'pink', 'green', 'blue', 'purple']`, absent for yellow). `Project.addNote(diagram, x, y)`, `setNoteText`, `setNoteColor` (an unknown color ignored; reading drops one). A file with a Note is accepted in both kinds; Connections and Legs still only join Components, Entities and Associations.
- **Size**: drawn 180 px wide, the text wrapping, the height following it (at least 80 px); `estimatedSize` guesses it from the text (characters per line, line count) for the server and Tidy up's obstacles.
- **Tidy up**: a Note outside every Zone is left out of the layout: never moved, never on the grid of loose elements. A Note in a Zone is laid out with the Zone's content, so that the Zone fitted around it still holds it.
- **Canvas**: a `NoteNode` for both kinds, editable in place (a double click opens a textarea; Escape or a click outside closes it; Cmd/Ctrl+Enter too). No handles. The panel for a Note shows its text and the five color swatches.
- **Palette**: a Note item in both palettes, dropped with the preview and snapping like the others.
- **SVG export**: the Note drawn as a rounded paper rectangle in its color, the text wrapped at the same width.
- **MCP**: `add_note` (diagram, text, color, near: an element to place it beside, else a free spot), `set_note` (text, color) and Notes listed in `get_diagram` (id, text, color, zone) for both kinds; `delete_elements` already takes any node.
- **Glossary**: Note.

## Testing Decisions

- Model: add, edit and recolor a Note; an unknown color ignored and read as yellow; a Note in an MCD is accepted and ignored by the MLD; a Connection to a Note is refused; a file round trip keeps it.
- Layout: Tidy up leaves a Note where it was; a Note in a Zone is laid out with its content.
- MCP: add_note beside an element, set_note, get_diagram lists it, in both kinds.
- SVG: a Note drawn in its color with its wrapped text.
- By hand: drop, edit, recolor, move into a Zone and with it, delete, export; in an MCD too.

## Out of Scope

Lines from a Note to an element; rich text; Note sizes set by hand; Notes in the all-diagrams zip's MCD files (MCDs are not in the zip yet).
