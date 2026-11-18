---
title: zone-provider - a Provider on a Zone, taken by what it holds
tags: [spec]
date: 2026-11-19
status: done
---

# zone-provider

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Provider, Zone).

## Problem Statement

Everything inside a Zone usually runs at the same place: a VPS at OVHcloud, a home server. Setting the same Provider on each Component one by one is tedious (twenty times in a homelab) and drifts as Components are added.

## Solution

A Zone can carry a Provider, shown as a logo in its title. A Component without a Provider of its own takes the one of the innermost Zone around it that has one, and shows it as its badge, named on hover with where it comes from ("Provider: OVHcloud (from VPS OVH)"). A Provider set on the Component always wins; External services still show none. In a Component's panel, an inherited Provider is shown above the grid; choosing one overrides it, "Not specified" goes back to it. A Zone's panel has the Provider grid too. Agents set it through MCP and read where each Provider comes from.

## Implementation Decisions

- **Data** (schema change, approved): optional `provider` on Zones, one of the Provider ids; an unknown one reads as unspecified. Nothing is stored on Components: the inherited Provider is computed from geometric membership (ADR 0007), so moving a Component into a Zone gives it that Zone's Provider.
- One model function gives every Component its effective Provider and the Zone it comes from.
- **MCP**: `add_zone` and `set_zone` take `provider` (`none` clears it); `get_diagram` gives each Zone its Provider and each Component its effective `provider` with `provider_from` (the Zone's name, or null when set on the Component).

## Testing Decisions

- Model: effective Provider (own wins, innermost Zone wins, none outside); set and clear on a Zone; import of an unknown one.
- MCP integration: a Zone's Provider reaches its Components, a Component's own overrides it.
- By hand: Zone title logo, inherited badge and its hover, panel hint.

## Out of Scope

Forcing "no Provider" on one Component inside a Zone that has one; Hosting on Zones.
