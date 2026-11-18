---
title: hosting-provider - who a Component runs at
tags: [spec]
date: 2026-11-18
status: done
---

# hosting-provider

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Provider, Hosting).

## Problem Statement

The Hosting badge says how a Component runs (Docker, Managed…) but not at whom: a managed database at AWS and one at Scaleway differ in cost, region and lock-in, and the diagram cannot tell them apart.

## Solution

Each Component can carry a Provider, from a fixed list of 18: AWS, Google Cloud, Azure, OVHcloud, Scaleway, Hetzner, IONOS, Clever Cloud, DigitalOcean, Vultr, Akamai (Linode), Alibaba Cloud, Cloudflare, Vercel, Netlify, Fly.io, Render, Railway. It shows as a small round badge with the Provider's logo in the Component's top-right corner, just left of the Hosting badge, named on hover. It is picked in the properties panel from a grid of logos, "Not specified" clearing it; any Hosting goes with any Provider. Agents set it through MCP.

## Implementation Decisions

- **Data** (schema change, approved): optional `provider` on Components, one of the 18 ids (`aws`, `google-cloud`, `azure`, `ovhcloud`, `scaleway`, `hetzner`, `ionos`, `clever-cloud`, `digitalocean`, `vultr`, `akamai`, `alibaba-cloud`, `cloudflare`, `vercel`, `netlify`, `fly`, `render`, `railway`); absent means unspecified; an unknown value (a newer file or peer) is read as unspecified rather than rejecting the import. The list lives in `packages/model`, beside the Hostings.
- **Logos**: Simple Icons logos in white on the brand color; AWS and Azure, which Simple Icons no longer ships, show a monogram on their color.
- **Picking**: a Provider section in the properties panel, under Hosting; the floating toolbar keeps the Hosting only.
- **MCP**: `add_component` takes an optional `provider`, a `set_provider` tool sets or clears it (`none`), `get_diagram` returns it.

## Testing Decisions

- Project document: set, change and clear a Provider; an unknown value is ignored on set and read as unspecified on import.
- MCP integration: `add_component` with a Provider, `set_provider`, `get_diagram` shows it.
- By hand: badges side by side and the panel grid in the browser.

## Out of Scope

A Provider on Zones (backlog), free-text or custom Providers (with custom Skins), regions.
