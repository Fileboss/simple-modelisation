---
title: Backlog
tags: [backlog]
---

# Backlog

## In progress

## To do

- Image export through MCP, and every Diagram at once
- SVG export readable outside browsers (Figma, Inkscape, slides): plain SVG shapes instead of HTML in a foreignObject
- SQL generation options (ON DELETE / ON UPDATE, naming) and other databases
- Custom Skins
- Zone colors, and Zones in Tidy up options (direction, spacing)
- Ternary Associations, inheritance and CIF in MCDs
- French UI
- Revoke a Share link for everyone (needs Project owners)
- End-to-end tests in CI (Playwright), once the product settles; until then they are run by hand per item
- Canvas performance on large Diagrams: keep unchanged node and edge objects between updates instead of rebuilding them all

## Done

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
