---
title: skin-picker - recommended Skins first, the rest on demand
tags: [spec]
date: 2026-11-18
status: done
---

# skin-picker

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Skin, Provider).

## Problem Statement

The properties panel lists every Skin of a Component type and all 18 Providers at once: ten Service Skins and eighteen Provider tiles push the rest of the panel out of sight, and the common choices are lost among the rare ones.

## Solution

The Skin and Provider grids show "Generic" (or "Not specified") and the most common choices first, plus the current one when it is not among them. A "Show all (N)" button opens the full list, "Show less" closes it again. When the full list is long (more than 8), a search field on top filters it by name, ignoring case and accents.

Recommended Skins, for the types with many: Service Node.js, Go, Python, Spring Boot, Bun; Gateway Nginx, Traefik, Caddy, Kong, Tailscale. The other types show all their Skins. Recommended Providers: Self-hosted, AWS, Google Cloud, Azure, OVHcloud, Scaleway, Hetzner.

Two Provider changes come with it: a **Self-hosted** Provider (a house) for one's own machines, a homelab or an on-premise server; and no Provider section, nor badge, for an External service, which is its own provider (a Provider set before stays stored, unshown).

## Implementation Decisions

- One grid component for both pickers, its visible choices computed by a pure function (recommended, current, expanded, query).
- The recommended lists live in the app's catalogs; every Skin stays accepted by the model and MCP. `self-hosted` joins the model's Provider ids (no schema change: a Provider is already one of a list, an unknown one reads as unspecified).
- The grid starts folded and empty of search for each newly selected Component (or a type change); the clearing tile always shows; choosing the current tile again clears it, for Skins as for Providers.
- The recommended lists are typed per Component type, so a Skin of another type is a compile error.

## Testing Decisions

- Unit tests on the visible-choices function: folded shows recommended plus current, unfolded shows all, the query filters ignoring case and accents.
- By hand: Service and Provider grids folded, unfolded, searched.

## Out of Scope

Ranking by use in the Project, favourites, custom Skins.
