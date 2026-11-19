---
title: image-hardening - a minimal, pinned and checked Docker image
tags: [spec]
date: 2026-11-19
status: done
---

# image-hardening

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Shared Project, relay).

## Problem Statement

v0.1 publishes one Docker image for anyone to run as a public relay. Today the runtime image carries npm, corepack and a global pnpm it never uses (more code, more CVEs), its base image is a moving tag (`node:26-alpine` changes under us, unseen), it has no health check, the public compose example only sets `read_only`, and nothing checks that the built image starts before it is pushed to ghcr.

## Solution

The runtime stage holds Node, the server's production dependencies and the built app, and nothing else: dependencies are installed in a build stage and copied, and npm, corepack and yarn are removed from the base. Both stages use `node:26-alpine` pinned by digest, which Dependabot's docker ecosystem keeps current. The server answers `GET /health`, and the image's `HEALTHCHECK` calls it. The public compose example drops every capability, forbids privilege escalation, and bounds memory and processes. On a `v*` tag, the image is built, started as a relay and smoke-tested before it is pushed.

## Implementation Decisions

- **Base**: `node:26-alpine@sha256:<digest>` in both stages (same digest), the tag kept for readability; Dependabot (`docker`, `/`, weekly, already configured) proposes digest bumps.
- **Dependencies**: a `deps` stage runs `pnpm install --prod --frozen-lockfile --filter "@simple-modelisation/server..."`; the runtime copies `node_modules` trees (root, `server/`, `packages/model/`) so the model stays a workspace symlink (ADR 0004). The runtime then deletes `/usr/local/lib/node_modules/{npm,corepack}`, their bin links and `/opt/yarn*`.
- **`/health`**: `GET` or `HEAD` returns `200` `ok` (`text/plain`), with the usual security headers, nothing about documents or load; other methods get `405`. It is answered before static files and MCP.
- **HEALTHCHECK**: `node -e` fetching `http://127.0.0.1:$PORT/health`, interval 30 s, timeout 5 s, start period 10 s, 3 retries. No curl or wget needed.
- **Public compose**: `read_only: true`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `mem_limit: 512m` with `MAX_DOCUMENTS: 80` (80 documents of 5 MB fit), `pids_limit: 100`, `tmpfs: /tmp`. The stored example gets `cap_drop` and `no-new-privileges` too (its volume is owned by `node`, no capability needed).
- **Smoke test** (`docker.yml`, at the tag only): build and load the image, run it with `STORAGE=none`, wait for the health status `healthy`, then check `/health` is `ok`, `/` is `200` HTML with a `Content-Security-Policy` header, and that `npm` and `pnpm` are absent from the image; only then push. A failure stops the push.

## Testing Decisions

- Sync server integration: `/health` answers `200 ok` with the security headers, `HEAD` too, and does not depend on storage.
- By hand: build the image locally, run the public compose, see `healthy`, open the app and share a Project through it; `docker run --rm --entrypoint sh <image> -c 'command -v npm'` finds nothing.

## Out of Scope

Distroless or hardened base images; image signing and SBOM attestation; a smoke test on every PR (the image is only checked at the tag); the release itself (next item).
