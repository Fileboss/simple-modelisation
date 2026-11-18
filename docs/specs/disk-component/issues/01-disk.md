---
title: '01: Disk Component type'
tags: [ticket, disk-component]
date: 2026-11-18
status: done
blocked_by: []
---

# 01: Disk Component type

Part of [disk-component](../spec.md).

**What to build:** Disks in the palette with their kind (HDD, SSD, NVMe, USB), in the panel and over MCP.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] `disk` type and `diskKind` in the model, validation and tests.
- [x] Palette, icon, subtitle and panel row.
- [x] MCP: `add_component` disk_kind, `set_disk_kind`, `get_diagram`; integration test.
- [x] Verified by hand in the browser.
