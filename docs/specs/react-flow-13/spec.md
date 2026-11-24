---
title: react-flow-13 - React Flow 12 to 13
tags: [spec]
date: 2026-11-24
status: done
---

# react-flow-13

Canvas: [ADR 0002](../../adr/0002-react-flow-canvas.md).

## Problem Statement

The canvas runs on React Flow 12; 13 is out, its upgrade (Dependabot PR 52) does not compile, and some of its new defaults would change what people see.

## Solution

React Flow 13, the canvas looking and behaving as before.

## Implementation Decisions

- Changes arrive as a changeset rather than a list: the snapping of drags and resizes rewrites them and applies the result through it.
- The single store is split: zoom, options and nodes are read from their own stores, the zoom only where it changes.
- Kept as it was, against new defaults: the canvas is light whatever the system's color mode, and a selected edge does not rise over the boxes.
- React Flow's styles are now in a CSS layer, under every unlayered rule: rules of the app it used to win over now reach its elements. The rule for every `button` leaves its zoom buttons out; the connection handles' size and color leave its resize handles (also named `handle`) out; a Zone handle's rule, which never applied, is gone. The app's element rules are not put in a layer of their own: `button:hover` would then lose to class rules it wins over now.
- Accepted differences: the view is framed with 13's default margin, 5% instead of about 4.5%; a press on a node that moves by a pixel without dragging it is now a click; while panning with Space, the hand shows over the background only, no longer over the edges.
- Other removed or changed APIs (connections, `useHandleConnections`, parents, `padding`) are not used by the app.

## Testing Decisions

- The same gestures and screenshots, driven on 12 and on 13, compared: System design and MCD, mouse, keyboard, touch, a system in dark mode, and every state (hovered, selected, dragged, connecting). By hand, not in CI.

## Out of Scope

Using what 13 adds (`useNode`, `changeParent`), and the canvas performance item of the backlog.
