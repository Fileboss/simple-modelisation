---
title: people - a Person Component type, drawn as a silhouette, with role Skins
tags: [spec]
date: 2026-11-19
status: done
---

# people

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Component type, Client, Skin, Hosting, Provider).

## Problem Statement

Business readers look first for who uses the system: a customer, an admin, a partner. A System design diagram has no way to say it: a Client is the device or the software the end user runs, not the person, so diagrams start from a browser instead of from someone.

## Solution

A new Component type, **Person**: someone who uses or runs the system. It is drawn apart from software, as a silhouette (a round avatar above its name, no box), so humans stand out at a glance. Its Skins are roles: **Customer, Admin, Partner, Support**. A Person has no Hosting, Provider or Runtime: none of these pickers shows for it, and MCP refuses them. It comes first in the palette, and Tidy up places Persons first along the flow, as Clients.

## Implementation Decisions

- **Model**: `'person'` first in `COMPONENT_TYPE_IDS` (the palette's order); an unknown type from a file or a peer still falls back to the Client look, now named explicitly instead of "the first type". `SKIN_IDS.person = ['customer', 'admin', 'partner', 'support']`. A Person keeps no `hosting` or `provider`: `setHosting` and `setProvider` ignore it, `setComponentType` to Person drops them, reading drops them, and it takes no Provider from a Zone (`effectiveProviders` skips it).
- **Looks**: the Person type look (a head-and-shoulders line glyph, a magenta color); each role a line glyph and color (Customer a bag, Admin a shield, Partner two people, Support a headset), drawn in white in the avatar.
- **Canvas**: a `ComponentNode` for a Person draws a 44 px avatar disc in the role's color (the type's without one) with the glyph in white, the name under it, the role under the name when it differs; the selection outline follows the avatar and the text; handles on its four sides. Its estimated size accounts for the column layout.
- **Panel**: for a Person, the type selector, the name and the role grid; no Hosting, Provider or Runtime.
- **SVG export**: the same silhouette.
- **Layout**: `layoutDiagram` keeps Persons, like Clients, at the start of the flow when a Connection goes back to them.
- **MCP**: `add_component` and `set_component` accept `person`; `hosting` and `provider` on a Person are refused ("A person has no hosting." / "… no provider."), as by `set_hosting` and `set_provider`; descriptions say what a Person is.
- **Glossary**: Person; Client's entry points to it.

## Testing Decisions

- Model: a Person ignores Hosting and Provider, drops them on a type change and when read, takes no Zone Provider; role Skins fit only Persons; an unknown type still reads with the Client look in the SVG.
- MCP: add a Person with a role; hosting or provider on it refused; set_hosting refused.
- SVG: a Person drawn as a disc with its name and role, no badges.
- Layout: a Person linked to a Client comes before it.
- By hand: drop a Person, pick each role, connect it, Tidy up, export.

## Out of Scope

Custom roles (free text stays the name); photos or initials in the avatar; a Person inside the MCD.
