---
title: connection-flow - a Flow on Connections, read, write or both
tags: [spec]
date: 2026-11-19
status: done
---

# connection-flow

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Connection, Flow, Component).

## Problem Statement

Every Connection is the same grey arrow. A reader cannot tell whether the arrow says who calls whom or where the data goes, nor whether a Service reads a Database, writes it, or both: a Next.js app that reads two sources at night to fill its own database looks like one that writes three databases.

## Solution

A Connection's arrow always goes from the Component that initiates (the client, the caller) to the one it reaches. A Connection gets an optional **Flow**, what its data does: **Read** (data comes back to the initiator), **Write** (data goes to the target), **Read/Write**. The Flow colors the line and its arrow, and shows as a word at the start of the label's pill ("Read · REST"); the free label stays beside it. A Connection without a Flow is drawn as today.

## Implementation Decisions

- **Model**: `FLOWS = ['read', 'write', 'read-write']`, `flow?: Flow` on `ConnectionEdge`, `Project.setConnectionFlow(diagram, connection, flow | null)`, an unknown value ignored. Edges are read through a normalisation that drops a Flow this version does not know (a newer file or peer), as nodes already are.
- **Looks** (`looks.ts`, shared by canvas and SVG): Read `#2563eb` (blue), Write `#ea580c` (orange), Read/Write `#7c3aed` (violet). Names in `ENGLISH_NAMES.flows`: Read, Write, Read/Write.
- **Canvas**: the line and arrow in the Flow's color (selection and remote highlight still win); the pill shows the Flow's name in its color, then the label after a middle dot. Label placement measures the whole pill text, so a Flow alone gets a pill too.
- **Panel**: a Connection's panel gets a Flow choice (Not specified, Read, Write, Read/Write) under the label, with a hint: "The arrow goes from who initiates; the Flow says what the data does."
- **SVG export**: same colors, one arrow marker per color used, same pill text.
- **MCP**: `connect_components` takes `flow`; a new `set_connection` tool changes a Connection's label and Flow (`none` clears) by its id, filling the gap that a label could not be changed; `get_diagram` lists `flow` (null when unset). Descriptions state the arrow convention.
- **Glossary**: Flow, and the arrow convention on Connection.
- **Room for pills**: a Flow lengthens pills, so Tidy up widens the gap between layers to the widest pill (English names, rough width, plus 50 px for the bends), never under 110 px; and label placement keeps pills off the badge strip over a Component's top-right corner and off every arrowhead, and reads a straight line as one segment even when ELK left a bend in its middle.

## Testing Decisions

- Model: set, change and clear a Flow; an unknown value ignored; an unknown Flow from a file read as none; the file round trip keeps it.
- MCP: `connect_components` with a Flow, `set_connection` changes label and Flow, `none` clears, an unknown Connection refused; `get_diagram` shows it.
- Layout: the gap between layers grows with the widest pill. Labels: a label stays off a box's badges and off arrowheads, and is centred on a straight line whatever bend ELK left in it.
- SVG: a Read Connection drawn in blue with a blue arrow and "Read · REST"; a Flow without a label still gets its pill.

## Out of Scope

Synchronous versus asynchronous Connections (dashed lines); a schedule (nightly) other than in the free label; data flow arrows going against the initiator.
