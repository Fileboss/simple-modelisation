---
title: component-hosting - a sneak peek at the infrastructure in System design
tags: [spec]
date: 2026-11-17
status: done
---

# component-hosting

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Hosting).

## Problem Statement

A System design diagram shows what talks to what, not where each part runs: whether the database is a managed cloud service or a container on our own server changes cost, operations and risk, and the diagram says nothing about it.

## Solution

Each Component can carry a Hosting: Bare metal, VM, Docker, Kubernetes, Managed, Serverless or External. It shows as a small round badge in the Component's top-right corner, an unmistakable icon on its color (Docker's blue whale, a cloud for Managed…), named on hover. Selecting a Component shows a small floating bar of Hosting icons above it; one click sets it, clicking the current one clears it; the properties panel offers the same choice. Agents set it through MCP.

## User Stories

1. As a developer, I want to say where a Component runs, so that the diagram gives a glimpse of the infrastructure.
2. As a developer, I want a small, clear badge on the Component, so that I read the infrastructure at a glance without clutter.
3. As a developer, I want to pick the Hosting from icons right above the selected Component, so that it takes one click.
4. As a developer, I want to clear a Hosting, so that a Component can stay unspecified.
5. As an agent user, I want my agent to set the Hosting when it draws, so that its diagrams carry the infrastructure too.

## Implementation Decisions

- **Data** (schema change, approved): optional `hosting` on Components, one of `bare-metal`, `vm`, `docker`, `kubernetes`, `managed`, `serverless`, `external`; absent or null means unspecified; an unknown value (a newer file or peer) is read as unspecified rather than rejecting the import. The list lives in `packages/model`.
- **Badge**: a small round badge in the top-right corner, icon on the Hosting's color; tooltip with the name. Docker and Kubernetes use their Simple Icons logos; the others are simple line icons (server rack, VM, cloud, λ, outgoing arrow).
- **Picking**: a floating toolbar above the selected Component (React Flow's node toolbar) and a Hosting row in the properties panel; clicking the current Hosting or "Not specified" clears it; the toolbar shows only for a single selection.
- **MCP**: `add_component` takes an optional `hosting`, a `set_hosting` tool sets or clears it (`none`), `get_diagram` returns it.

## Testing Decisions

- Project document: set, change and clear a Hosting; an unknown value is ignored; import accepts and validates it.
- MCP integration: `add_component` with a Hosting, `set_hosting`, `get_diagram` shows it.
- By hand: badge and floating toolbar in the browser.

## Out of Scope

Hosting providers (AWS, OVH…) as a second badge; grouping Components by host; Hosting on MCD elements.
