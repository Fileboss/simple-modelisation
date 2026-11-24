---
title: Backlog
tags: [backlog]
---

# Backlog

## In progress

## To do

- Findings from the global review after pre-release-fixes (not yet verified):
  - Server storage can be filled: creation limit per exact IP (not per IPv6 /64), no global size or document cap, no expiry (`server/src/sync-server.ts`, `document-store.ts`)
  - A peer's edit makes a node or Zone being dragged jump back to its stored position (`src/canvas/DiagramCanvas.tsx` `keepSelection`)
  - Browser tabs are not coordinated: one Local project in two tabs diverges until reload; a project deleted in one tab comes back empty from another

- Model cleanups: edges() without reading every node again, pasteable once per paste, one bounding-box helper
- MCP bookkeeping: reads that store the document again, MCP loads outside the sync's document count, one shared size check for MCP writes and the sync
- Numbered steps on Connections (1, 2, 3), to read a journey through the system
- A Job Component type (cron, batch, worker)
- Asynchronous Connections, drawn dashed (events, queues)
- SaaS Skins for external services (Stripe, Auth0, SendGrid, Slack…)
- PNG from export_diagram, so agents can see the diagram they drew (a server-side rasterizer)
- SQL generation options (ON DELETE / ON UPDATE) and other databases
- Custom Skins
- Selecting several elements by touch (a selection mode or a lasso)
- Zone colors, and Zones in Tidy up options (direction, spacing)
- French UI
- Revoke a Share link for everyone (needs Project owners)
- End-to-end tests in CI (Playwright), once the product settles; until then they are run by hand per item
- Canvas performance on large Diagrams: keep unchanged node and edge objects between updates instead of rebuilding them all

## Done

- reorder-tabs: the Diagrams' tabs dragged into another order
- [react-flow-13](docs/specs/react-flow-13/): React Flow 12 to 13, the canvas looking and behaving as before
- palette-help: the explanations of the palettes and the properties hidden behind an i button
- [mcd-areas](docs/specs/mcd-areas/): free colored Areas with a label behind an MCD, in the app, the exports and over MCP
- mcp-fold-set-component: set_skin, set_hosting, set_provider, set_runtime and set_disk_kind become fields of set_component (37 to 32 MCP tools)
- [duplicate-diagram](docs/specs/duplicate-diagram/): duplicate a Diagram, from its tab, the phone menu and over MCP
- [sql-constraints](docs/specs/sql-constraints/): UNIQUE, CHECK, named foreign keys and COMMENT ON, in the panel, the SQL and over MCP
- [mcp-batch-attributes](docs/specs/mcp-batch-attributes/): set_attribute, remove_attribute, delete_diagram, export_project and an all-or-nothing batch over MCP
- [note-resize](docs/specs/note-resize/): Notes can be made wider or narrower; other elements later
- [tidy-up-rework](docs/specs/tidy-up-rework/): a tighter Tidy up that places Notes too, vertical for MCDs, and an MCP tool to move elements
- [mcd-svg](docs/specs/mcd-svg/): MCDs as plain SVG (Merise and UML), over MCP, in the app and in the all-diagrams zip
- thin-borders-zoomed-out: MCD box borders stay one screen pixel wide when zoomed out, instead of losing pieces on a non-Retina screen
- stop-sharing-copy: Stop sharing keeps the original until the Local copy is read back from storage with the same content
- [malformed-documents](docs/specs/malformed-documents/): a malformed entry in a Shared Project is left out, with a banner, instead of breaking the app for every Participant
- collapsible-panels: on a wide screen, the palette and the properties fold into thin rails (Cmd/Ctrl+\ for both), remembered per browser
- [mobile-layout](docs/specs/mobile-layout/): the canvas first on phones, Palette, Panel and SQL as drawers; tap to place, big handles, long-press menu on touch screens
- [relative-identifier](docs/specs/relative-identifier/): Entities identified relative to others, a 1,1 Leg marked R, in the MLD, both Notations and MCP
- [entity-inheritance](docs/specs/entity-inheritance/): parent and child Entities with X / T / XT, three MLD translations, both Notations, MCP
- [cif-constraints](docs/specs/cif-constraints/): CIFs on N-ary Associations, drawn as in Looping, in the MLD and over MCP
- [nary-associations](docs/specs/nary-associations/): Associations between three Entities or more, in both Notations, the MLD and MCP
- sql-name-line-breaks: a line break in an Entity, Association or Diagram name no longer escapes the `--` comments of the PostgreSQL script
- v0.1 release: CHANGELOG and the v0.1.0 tag
- github-settings: v0.1, GitHub rulesets on main and v* tags, merge commits only, Actions pinned by commit and read-only
- [pre-release-fixes](docs/specs/pre-release-fixes/): v0.1, fixes from the global review: Safari cut, Note editing, static cache, documents per address, paste
- [relay-limits](docs/specs/relay-limits/): v0.1, bound what one client can do to a public relay: documents per address, message and Presence size, true document size, malformed peer fields, proxy-only deployments
- [export-legend](docs/specs/export-legend/): v0.1, a Legend in exported images of System design diagrams (Flows, Providers, Hostings, Runtimes), with a toggle
- [copy-paste](docs/specs/copy-paste/): v0.1, copy, cut, paste and duplicate on the canvas, through the system clipboard
- [notes](docs/specs/notes/): v0.1, sticky Notes on the canvas in five colors, in System design diagrams and MCDs
- [people](docs/specs/people/): v0.1, a Person Component type drawn as a silhouette, with role Skins (Customer, Admin, Partner, Support)
- selection-gestures: drag on the background selects, Shift+click adds, Delete, Cmd/Ctrl+A, Escape; Space+drag pans
- [drag-and-snap](docs/specs/drag-and-snap/): drop where the preview shows, snap to neighbours with guides, straight Connections
- [connection-flow](docs/specs/connection-flow/): a Flow on Connections (Read, Write, Read/Write), the arrow from who initiates
- [service-runtime](docs/specs/service-runtime/): a Runtime badge on Services, Service Skins as frameworks and products, Client Skins as devices
- [image-hardening](docs/specs/image-hardening/): v0.1, a minimal runtime image pinned by digest, HEALTHCHECK on /health, the public compose hardened, a smoke test at the tag
- [app-hardening](docs/specs/app-hardening/): v0.1, the exposed server hardened for a public relay
- [relay-mode](docs/specs/relay-mode/): sharing without server storage, for a public deployment
- [svg-export](docs/specs/svg-export/): System design diagrams as plain SVG, over MCP and in the app
- [component-type-picker](docs/specs/component-type-picker/): change a Component's type in the panel
- [set-component](docs/specs/set-component/): set_component MCP tool (type, name, place)
- [zone-provider](docs/specs/zone-provider/): a Provider on a Zone, taken by the Components inside it
- [skin-picker](docs/specs/skin-picker/): recommended Skins and Providers first, show all, search; Self-hosted Provider
- [disk-component](docs/specs/disk-component/): Disk Component type (HDD, SSD, NVMe, USB)
- [more-skins](docs/specs/more-skins/): Caddy, Bun, Python, Rust, Vaultwarden, Tailscale, AdGuard… Skins
- [stop-sharing](docs/specs/stop-sharing/): stop sharing a Project on this device, keeping a Local copy
- [hosting-provider](docs/specs/hosting-provider/): Provider (AWS, OVHcloud, Hetzner…) as a second badge on Components
- [grouping-zones](docs/specs/grouping-zones/): Zones (region, VPC, subnet) grouping Components in System design diagrams
- [image-export](docs/specs/image-export/): a Diagram as a PNG or SVG image
- trackpad-gestures: two fingers pan, pinch zooms, Cmd/Ctrl+wheel zooms
- bidirectional-tidy: Tidy up keeps A→B and B→A on one shared route (a two-way arrow)
- [label-placement](docs/specs/label-placement/): Connection labels never overlap each other or boxes
- [component-hosting](docs/specs/component-hosting/): Hosting badge and picker on Components, MCP set_hosting
- deps-hygiene: typescript-eslint 8.73 (fixes the minimatch alert), @types/node 26
- [orthogonal-routing](docs/specs/orthogonal-routing/): ELK layout, right-angle routes, tighter MCDs
- [auto-layout](docs/specs/auto-layout/): Tidy up button and layout_diagram tool, routed Connections and Legs
- [mcp-server](docs/specs/mcp-server/): AI agents read and edit Shared Projects over MCP
- [uml-notation](docs/specs/uml-notation/): Merise / UML switch per MCD, editable class diagram
- [postgres-sql](docs/specs/postgres-sql/): Attribute Data types, MLD and PostgreSQL script under every MCD
- [live-presence](docs/specs/live-presence/): Participants' avatars, cursors and selections on Shared Projects
- [realtime-sync](docs/specs/realtime-sync/): Shared Projects synced in real time, Share links
- [v1-core](docs/specs/v1-core/): Projects, System design diagrams and MCDs, local only
