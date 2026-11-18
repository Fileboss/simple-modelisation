---
title: more-skins - Caddy, Bun, Python, Rust and the products of a homelab
tags: [spec]
date: 2026-11-18
status: done
---

# more-skins

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Skin, Component type).

## Problem Statement

The catalog offers three Skins per Component type. A real System design diagram (a homelab: Caddy in front, a Bun app, Python machine learning, Vaultwarden, Tailscale, AdGuard) leaves most Components generic, though their products have well-known logos.

## Solution

New Skins, all with their Simple Icons logo:

| Component type | New Skins                                            |
| -------------- | ---------------------------------------------------- |
| Client         | Apple                                                |
| Service        | Bun, Python, Rust, Caddy, Vaultwarden, Kiwix, GitHub |
| Gateway        | Caddy, Tailscale, AdGuard                            |

Services take both runtimes (Node.js, Go, Bun, Python, Rust) and products (Vaultwarden, Kiwix, GitHub); Caddy is both a Gateway (reverse proxy) and a Service (a file server). Agents can use them through MCP like the others.

## Implementation Decisions

- The Skin ids extend the model's list (`apple`; `bun`, `python`, `rust`, `caddy`, `vaultwarden`, `kiwix`, `github`; `caddy`, `tailscale`, `adguard`): no schema change, a Skin is already any string and an unknown one reads as generic.
- One look per Skin id, shared by every Component type that offers it.

## Testing Decisions

- MCP integration: `set_skin` accepts a new Skin and refuses it on a type that does not offer it.
- By hand: the panel grids and the logos in the browser.

## Out of Scope

Custom Skins; products without a Simple Icons logo (restic, healthchecks.io, Freebox) stay generic.
