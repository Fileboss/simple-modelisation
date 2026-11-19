---
title: service-runtime - a Runtime badge on Services, Skins sorted into frameworks and products
tags: [spec]
date: 2026-11-19
status: done
---

# service-runtime

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Component, Component type, Skin, Runtime, Hosting, Provider).

## Problem Statement

A Service's Skins mix three levels: runtimes and languages (Node.js, Bun, Go, Python, Rust), a framework (Spring Boot) and products (Caddy, Vaultwarden). Saying "a Next.js app on Bun" would need one Skin per framework and runtime pair, and choosing Next.js would lose that it runs on Bun. Client Skins mix levels too: React and Vue are web frameworks, Android and Apple are devices.

## Solution

Diagrams take the server's point of view. A web app, even a front end, is a Service: its Skin is its framework, and its **Runtime** is what runs it on the server. A Client is what the end user runs it in: a web browser, a phone, a desktop.

- A Service has an optional Runtime: Node.js, Bun, Java, .NET, Python, PHP, Ruby, Go, Rust. It names what executes the code, or the language for a native binary (Go, Rust).
- A Service's Skins are frameworks (Next.js, Nuxt, SvelteKit, Svelte, React, Vue, Angular, NestJS, Express, Fastify, Spring Boot, Quarkus, Django, FastAPI, Laravel, Ruby on Rails) and products (Caddy, Vaultwarden, Kiwix, GitHub), shown in two sections. The runtimes are no longer Skins.
- A Client's Skins are Web browser, Android, iOS, Desktop.
- The Component's main logo is its Skin's, else its Runtime's, else its type's glyph. The Runtime shows as a badge only beside a Skin: a pure Rust service shows the Rust logo as today, a Next.js app on Bun shows Next.js with a Bun badge.

No migration: a removed Skin (`nodejs`, `go`…, `react` and `vue` on a Client, `apple`) reads as Generic, as any Skin a type does not offer. The local development database is wiped after the change.

## Implementation Decisions

- **Model** (`packages/model`): `RUNTIMES = ['nodejs', 'bun', 'java', 'dotnet', 'python', 'php', 'ruby', 'go', 'rust']`, `runtime?: Runtime` on `ComponentNode`, `Project.setRuntime(diagram, component, runtime | null)` ignored on other types and for an unknown value. Like a Disk kind, only a Service has one: changing the type drops it, and reading drops it elsewhere or when unknown.
- **Skins**: `SKIN_IDS.service` holds the frameworks then the products; a `SERVICE_FRAMEWORKS` list in `skins.ts` says which are frameworks, for the panel's sections and the MCP descriptions. `SKIN_IDS.client` is `['browser', 'android', 'ios', 'desktop']`.
- **Looks**: Simple Icons logos (Java takes OpenJDK's, in Java's orange); Web browser and Desktop have no brand, so `SkinLook` gains a line `glyph` alternative to `logo`. `RUNTIME_LOOKS` serve both as the main logo and, in white on their color, as the badge.
- **Canvas and SVG export**: the same rule for the main logo and the subtitle (the Skin's name, else the Runtime's, else the type's); the Runtime badge first in the badge row, before Provider and Hosting, read as "what, on whom, how".
- **Panel**: a Runtime picker (ChoiceGrid, Node.js, Bun, Python, Go, Java, Rust recommended) under the type, Services only. The Skin grid shows section headings when its choices have groups (Frameworks, Products).
- **MCP**: `add_component` takes `runtime` and a new `set_runtime` tool sets or clears it (`none`), like `set_disk_kind`; both refuse a non-Service; `get_diagram` lists a Service's `runtime`; descriptions list the Runtimes and the frameworks.

## Testing Decisions

- Model: `setRuntime` on a Service, ignored on others and for an unknown value; dropped by `setComponentType` away from Service; read without it on other types or when unknown; a removed Skin reads as Generic.
- MCP: `add_component` with a runtime, refused on a Database; `set_runtime` sets it and clears it with `none`, refused on a Database; the view shows it.
- SVG: a Service with a Runtime and no Skin draws the Runtime logo and no badge; with both, the Skin logo and a Runtime badge.
- Section grouping: the visible choices keep their groups (unit test on the grid helper).

## Out of Scope

Runtimes on other Component types (a Database's engine is its Skin); Client runtimes; a runtime version; migrating old Skins.
