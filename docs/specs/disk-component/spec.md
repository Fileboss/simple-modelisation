---
title: disk-component - physical disks in System design diagrams
tags: [spec]
date: 2026-11-18
status: done
---

# disk-component

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Disk, Component type, Zone).

## Problem Statement

A homelab or an on-premise system keeps data on physical disks: an SSD for photos, an NVMe for a database, a USB disk for monthly backups. The only storage type is Object storage (S3, MinIO), so disks are drawn as buckets or hidden in names.

## Solution

A new Component type, **Disk**, with its own disk icon in the palette. A Disk has an optional **Disk kind**: HDD, SSD, NVMe or USB, picked in the properties panel and shown under its name ("SSD"). It goes in its machine's Zone and is connected to the services that use it, like any Component. Agents add and change Disks through MCP.

## Implementation Decisions

- **Data** (schema change, approved): `disk` joins the Component types; an optional `diskKind` on Disks, one of `hdd`, `ssd`, `nvme`, `usb`; an unknown value reads as unspecified, as for Hosting. Capacity stays in the name.
- A Disk kind is not a Skin (a Skin is a market product); Disks have no Skins.
- Disks count as stores in Tidy up's flow order, like Databases and Object storage.
- **MCP**: `add_component` takes `type: disk` and an optional `disk_kind`; a `set_disk_kind` tool sets or clears it (`none`); `get_diagram` returns it.

## Testing Decisions

- Project document: set, change and clear a Disk kind, only on Disks; import reads an unknown one as unspecified.
- MCP integration: add a Disk with a kind, change it, read it back.
- By hand: palette, icon, subtitle and panel row in the browser.

## Out of Scope

Capacity and usage fields, RAID and NAS, Skins for disk brands.
