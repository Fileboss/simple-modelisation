---
title: export-legend - a Legend in exported images of System design diagrams
tags: [spec]
date: 2026-11-19
status: done
---

# export-legend

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (System design diagram, Legend, Flow, Provider, Hosting, Runtime, Skin, Zone).

## Problem Statement

An exported image of a System design diagram carries marks that only the app explains: the colors of Flows on Connections, and the round Provider, Hosting and Runtime badges on Components and Zones. On the canvas, a badge has a tooltip; in a PNG pasted into a pull request or a slide, a reader has nothing to go by. The app's PNG is also a picture of the page, not the plain SVG the other exports draw, so anything added to the image would have to be drawn twice.

## Solution

Exported images of a System design diagram get a Legend: a small framed box placed below the content, its right edge aligned with the content's. It names only the marks the image shows, in sections stacked vertically, in badge order:

- **Flow**: each Flow used on a Connection, as a short arrow in its color and its name (Read, Write, Read/Write);
- **Provider**: each Provider badge drawn, on Components (their own or their Zone's) and on Zones;
- **Hosting**: each Hosting badge drawn;
- **Runtime**: each Runtime drawn as a badge (a Service with a Skin); a Runtime shown as the Service's main logo already has its name printed.

Skins and Component types are left out: their names are on the boxes. With nothing to explain, there is no Legend and the image is as today.

The Legend is in every export of a System design diagram: the app's "Diagram as PNG" and "Diagram as SVG", the "All diagrams" zip, and the MCP `export_diagram` tool. The app's PNG becomes the plain SVG rasterized in the browser, so the PNG and the SVG show the same image. MCDs are unchanged: no Legend, the page capture for their PNG and SVG.

It can be turned off: an "Include legend" checkbox in the Export menu, on by default and remembered in this browser, applies to the three app exports; `export_diagram` takes an optional `legend` boolean, true by default.

## User Stories

1. As a developer reading an exported System design diagram, I want the Flow colors named, so that I know which Connections read and which write.
2. As a developer reading an exported image, I want each Provider badge named, so that I know whose infrastructure a Component runs on without the app's tooltips.
3. As a developer reading an exported image, I want each Hosting badge named, so that I know how a Component runs.
4. As a developer reading an exported image, I want each Runtime badge named, so that I know what runs a Skinned Service.
5. As a developer, I want the Legend to list only what the image shows, so that it stays short and true.
6. As a developer, I want no Legend when the Diagram uses none of these marks, so that a simple image stays simple.
7. As a developer, I want the Legend below the content, bottom right, so that it never covers a Component or a Connection.
8. As a developer, I want the same Legend in the PNG and the SVG, so that both formats say the same thing.
9. As a developer, I want the Legend in each SVG of the "All diagrams" zip, so that every file stands on its own.
10. As a developer, I want to turn the Legend off in the Export menu, so that I get a bare image when I explain it myself.
11. As a developer, I want my choice remembered in this browser, so that I need not uncheck it at each export.
12. As a developer, I want my choice to stay mine, so that it changes nothing for the other Participants of a Shared Project.
13. As an agent using MCP, I want the Legend in `export_diagram`'s SVG by default, so that the image I hand my user explains itself.
14. As an agent, I want to pass `legend: false`, so that I can get the bare image.
15. As a developer exporting an MCD, I want its export unchanged, so that nothing about MCDs breaks.
16. As a developer with a large Diagram, I want the PNG to keep working within the browser's canvas limits, so that a big export does not fail.

## Implementation Decisions

- **Renderer**: the model package's System design SVG renderer takes a `legend` option (default true) and draws the Legend from what it has drawn: Flows of the Connections drawn, Provider badges actually shown (an External Component shows none; Zones' Providers count), Hosting badges, Runtimes shown as badges. Entries keep the order of each catalog; the marks are the same badges and arrow colors as in the image. Section headings and entry names come from the names passed in (the app's UI strings, the server's English names), so the Legend is translated with the UI; the names gain the four section headings where they lack them.
- **Layout**: the box sits a gap below the content's bounds, its right edge on the content's right edge; when the content is narrower than the box, the frame widens to the left. The frame and margin grow to hold it.
- **PNG**: for a System design diagram, the app rasterizes the renderer's SVG (SVG → image → canvas → PNG) at the measured sizes, at the current scale (2, lowered within the existing canvas limits). The page capture stays for MCDs.
- **Preference**: "Include legend" is a per-browser preference in local storage (read and written defensively), not in the Project document: no schema change, nothing synced. Shown only as a checkbox in the Export menu; MCD exports ignore it.
- **MCP**: `export_diagram` gains an optional `legend` boolean (default true), described in the tool's schema.

## Testing Decisions

- Tests check the output, not the internals: the SVG holds a Legend with the expected entries and headings, or none.
- Renderer unit tests (prior art: the existing System design SVG tests): Flows used are listed and unused ones are not; a Provider taken from a Zone is listed, an External Component's is not; a Runtime is listed only when drawn as a badge; no Legend with nothing to explain or with `legend: false`; the frame holds the Legend (it lies within the view box, below the content); user names stay escaped; output stays deterministic.
- MCP integration (prior art: the `export_diagram` tests): the Legend is there by default and absent with `legend: false`.
- By hand: PNG and SVG of the Twitter-like copy with the Legend on and off, the checkbox remembered after a reload, the zip, an MCD export unchanged, a large Diagram as PNG.

## Out of Scope

A Legend on the canvas; a Legend for MCDs; listing Skins or Component types; choosing the Legend's position; a per-Diagram or per-Project setting; PNG from the server.
