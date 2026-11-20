---
title: mobile-layout - the canvas first on phones, the side panels as drawers
tags: [spec]
date: 2026-11-20
status: done
---

# mobile-layout

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Project, Diagram, Note, Connection).

## Problem Statement

On a phone the Project page does not work. The Palette (180 px) and the Panel (260 px) are fixed columns that leave almost nothing of the canvas, the header and the Diagram tabs overflow, and the SQL panel takes a third of the height. Adding an element is an HTML5 drag from the Palette, which a finger cannot do, on a phone or a tablet. Handles are too small to start a Connection, and Delete, duplicate, copy and paste need a keyboard.

## Solution

Two independent switches:

- **Layout, by width**: under 768 px the canvas takes the whole screen below a one-line header. The Palette, the Panel and the SQL panel become **drawers** that rise from the bottom over the canvas, opened by round floating buttons: **+** (Palette) bottom left, **⚙** (Panel) bottom right, **SQL** beside it on MCDs. One drawer is open at a time; the canvas stays visible and usable above it. Above 768 px the layout is unchanged.
- **Gestures, by pointer**: on a coarse pointer (any touch screen, phone or tablet, either orientation) adding is _tap then place_, handles are big, and a long press opens a context menu. A mouse keeps today's gestures.

Full editing is the goal: everything the desktop does is reachable on a phone.

### Header on a small screen

One line: a **☰** menu (Share / Copy link, Stop sharing, Export and its options, back to the Projects), the open Diagram's name as a picker (switch Diagram, add a System design diagram or an MCD, rename, delete the open one after a confirmation), then **↶ ↷** for undo and redo.

### Adding by touch

Tapping a Palette item arms it for that Diagram: the drawer closes, a hint at the top of the canvas says where to tap ("Tap the canvas to place a Service", with a Cancel). The next tap on the canvas, on the background or on an element (into a Zone), places it there, with the same snapping as a drop; panning and pinching while armed still move the view. Cancel, Escape, or tapping the + button again disarms. On a wide touch screen the Palette stays a column and its items are tapped the same way; the mouse still drags.

### Panel drawer

Selecting an element does not open it: the ⚙ button shows a dot when something is selected, and a tap on it opens the drawer with the selection's Panel (the Diagram's options when nothing is selected, as today). A double tap on an element opens it too, except where a double tap edits text in place (Notes, names), which keeps that behavior.

### Connections by touch

On a coarse pointer the handles of the selected element (and of a node under the finger while connecting) are drawn as 28 px discs, hit area 44 px, and a Connection is made by dragging from one to the target, as with the mouse.

### Long press

A long press (500 ms without moving more than 8 px) opens a small context menu at the finger:

- On a node: Properties (on a small screen, where the Panel is a drawer), Duplicate, Copy, Cut, Delete. On a Connection: Properties, Delete. The element is selected first.
- On the background: Paste here, Select all. The page cannot read the clipboard before the tap, so Paste here is always offered and says so when there is nothing to paste.

The menu closes on a tap elsewhere or Escape. The browser's own menu, text selection and iOS callout are suppressed on the canvas. Duplicate, Copy, Cut, Paste reuse the copy-paste item's actions; Paste here pastes at the finger.

### Home and Join pages

They fit a 320 px wide screen without horizontal scrolling: the Project list wraps, buttons keep a 44 px touch height.

## Implementation Decisions

- **Breakpoint**: one `(max-width: 767px)` media query, read in CSS and through one `useMediaQuery` hook in React where the tree differs (drawers, header). The `coarsePointer` constant of `DiagramCanvas.tsx` becomes a shared hook on `(pointer: coarse)` so that it follows a change (a tablet with a keyboard and a trackpad).
- **Drawers**: one `Drawer` component (title, close ×, content scrolling, at most 60 % of the height, the SQL drawer up to 90 %), rendered over the canvas; the existing `kind.Palette`, `kind.Panel`, `NotePanel` and `SqlPanel` content is reused unchanged inside it. Which drawer is open is UI state of the Project page, not stored.
- **Tap to place**: `palette-drag.ts` grows an _armed item_ next to the dragged one; the canvas places it on the next `pointerup` that was a tap (less than 8 px of movement), through the same code path as a drop (`previewAt` and the snapping).
- **Long press**: one hook on the React Flow pane and nodes (pointer events, timer cancelled by movement, by a second pointer or by `pointerup`), opening a `ContextMenu` component; `contextmenu` events are prevented on the canvas so Android does not open its own menu as well.
- **Safe areas and zoom**: the viewport meta gains `viewport-fit=cover`; floating buttons and drawers respect `env(safe-area-inset-*)`. Form fields use at least 16 px text so iOS does not zoom on focus. The page uses `100dvh`, so the browser bars do not hide the buttons.
- **Strings**: the new ones (menu entries, hints, button labels) go with the others in the strings module, in English.

## Testing Decisions

- Unit: the long-press detector (fires after the delay, not after movement past the threshold, not with two fingers, not after release); tap-to-place arming and disarming.
- By hand, on a real phone (iOS Safari and Android Chrome) and the browser's device mode: add each kind of element by tap, connect two Components, long press each menu entry, edit a Panel field without the page zooming, switch, add, rename and delete Diagrams, export, share, open the SQL drawer on an MCD; then on a tablet in both orientations; then check the desktop is unchanged.
- e2e stays by hand (not in CI), as for the other items.

## Out of Scope

Selecting several elements by touch (a selection mode or a lasso), written in BACKLOG.md. Movable floating windows. Offline install (PWA). A layout tuned for tablets in portrait beyond what the width breakpoint gives.
