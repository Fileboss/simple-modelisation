---
title: svg-export - System design diagrams drawn as plain SVG, over MCP and in the app
tags: [spec]
date: 2026-11-19
status: done
---

# svg-export

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Diagram, Component, Zone, Connection, Skin, Hosting, Provider).

## Problem Statement

An agent drawing a System design diagram over MCP cannot see the result, nor hand an image to its user. In the app, the SVG export is a picture of the page (HTML inside a foreignObject): browsers show it, but Figma, Inkscape and slide tools show nothing. And each Diagram is exported on its own.

## Solution

A renderer draws a System design diagram as plain SVG shapes from the Project document: Zones, Components with their Skin logo, name, subtitle and badges, Connections along their routes with arrowheads and labels. The MCP server uses it in a new `export_diagram` tool, which returns the SVG; without a Diagram, it returns every System design diagram. The app's "Diagram as SVG" uses it for System design diagrams, and a new "All diagrams (SVG)" downloads a .zip of them.

MCDs follow in a second item: until then, an MCD keeps the app's current SVG export and is left out of `export_diagram` and the .zip (with a note saying so).

## Implementation Decisions

- **Shared drawing data**: route geometry, Connection label placement, and the looks (colors, logo paths) of Component types, Skins, Hostings and Providers move from the app to the model package, so the server draws what the app draws. UI names stay in the app's strings; the renderer takes the names it prints.
- **Sizes**: the renderer takes each box's size: the app gives the sizes it measured, the server the model's estimates; text widths are estimated the same way (the app may pass a measuring function).
- **Plain SVG**: rects, paths and text only, with system fonts; logos are the Simple Icons paths; the image is framed on its content with a margin, on white.
- **MCP**: `export_diagram` (project, optional diagram) returns a note, then each System design diagram as an embedded SVG resource (`image/svg+xml`), which clients can show or save. Agents read it as text: Claude views PNG, JPEG, GIF and WebP images, not SVG; a PNG from the server would need a rasterizer (a later item if wanted).
- **Zip**: a small zip library, loaded on demand like the capture library.

## Testing Decisions

- Renderer unit tests on a small diagram: a shape per Zone and Component, a path with an arrowhead per Connection, labels and names as text, escaped; deterministic output.
- MCP integration: `export_diagram` returns SVG for a System design diagram, all of them without a Diagram, a clear note for MCDs.
- By hand: the app's SVG opened in a browser and checked against the canvas; the zip's content.

## Out of Scope

MCDs (second item), PNG from the server, remote collaborators' presence in images.
