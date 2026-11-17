---
title: image-export - a Diagram as a PNG or SVG image
tags: [spec]
date: 2026-11-17
status: done
---

# image-export

Vocabulary: [GLOSSARY](../../../GLOSSARY.md).

## Problem Statement

A Diagram lives only in the app: to put it in a document, a pull request or a slide, a developer has to take a screenshot, cropped by hand, with the grid, the controls and the selection in it.

## Solution

The header's Export button becomes a small menu: Project (JSON) as before, Diagram as PNG, Diagram as SVG. The image holds the whole open Diagram, framed on its content with a margin, on a white background, without the canvas grid or any interface (controls, collaborators' cursors and selections, Hosting picker, selection outlines, connection dots). An MCD is exported in the Notation shown, without the MLD / SQL panel. The file is named after the Diagram.

## User Stories

1. As a developer, I want a PNG of a Diagram, so that I can paste it into a document, a pull request or a slide.
2. As a developer, I want an SVG of a Diagram, so that it stays sharp at any size.
3. As a developer, I want the whole Diagram, even the parts off screen, so that I need not zoom out first.
4. As a developer, I want no interface in the image, so that it looks clean.
5. As a developer, I want the file named after the Diagram, so that I find it again.

## Implementation Decisions

- **Library**: `modern-screenshot` (maintained successor of `html-to-image`, React Flow's documented approach), imported on the first export.
- **Frame**: the nodes' bounds plus a 32 px margin at zoom 1; PNG drawn at scale 2; white background.
- **Clean image**: the canvas viewport is captured with the selection cleared first; handles, remote cursors and the node toolbar are filtered out; remote selection outlines are hidden while exporting.
- **Menu**: Export → Project (JSON), Diagram as PNG, Diagram as SVG; the open Diagram's canvas registers its exporter so the header can reach it.

## Testing Decisions

- The frame computation (size and transform from the nodes' bounds) is unit tested.
- By hand: PNG and SVG of the Twitter-like copy and of an MCD in both Notations; check content, size and the absence of interface.

## Out of Scope

Image export through MCP; exporting every Diagram at once; transparent background; PDF.
