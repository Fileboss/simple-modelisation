---
title: component-type-picker - change a Component's type in the panel
tags: [spec]
date: 2026-11-19
status: done
---

# component-type-picker

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Component, Component type).

## Problem Statement

In the app, a Component's type is set once, by the palette item it was dropped from. Turning an Object storage into a Disk, or a Service into a Gateway, means deleting it, drawing it again and redoing its Connections; agents can already do it in place over MCP.

## Solution

A "Type" dropdown at the top of a Component's properties panel lists the Component types in the palette's order. Choosing one changes the Component in place, as one undo step: its id, name, Connections, Hosting and Provider stay; a Skin the new type does not offer goes back to Generic; a Disk kind goes away unless it is still a Disk, and the panel shows the Kind row when it becomes one.

## Implementation Decisions

- The panel calls the model's type change (the one `set_component` uses); nothing new in the model or MCP.
- A native select, labelled for screen readers, keeps the panel compact.

## Testing Decisions

- The model rules are already tested; by hand in the browser: change a type, check the subtitle, the Skin, the Kind row, the Connections and undo.

## Out of Scope

Changing several Components' type at once.
