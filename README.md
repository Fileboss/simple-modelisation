# simple-modelisation

A lightweight, collaborative web app where developers draw system architectures (System design diagrams: Components with market-product Skins, Zones, Hosting and Provider badges) and database models (MCDs in Merise or UML, with their MLD and PostgreSQL script).

Projects live in the browser. Sharing one syncs it in real time with whoever holds its link; AI agents can read and edit Shared Projects over MCP.

## Run it locally

Node 26 and pnpm are needed.

```sh
pnpm install
make dev     # the app on http://localhost:5173, the sync server on :3000
make lint test
```

## Deploy

One Docker image serves the app, the sync of Shared Projects and the MCP endpoint. A `vX.Y.Z` tag publishes it as `ghcr.io/fileboss/simple-modelisation:X.Y.Z`.

| Setting         | Default                          | What it does                                                                                                         |
| --------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `PORT`          | `3000`                           | The port the app, `/sync` and `/mcp` answer on.                                                                      |
| `STORAGE`       | `sqlite`                         | `sqlite` keeps Shared Projects in `DATA_DIR`; `none` makes the server a relay that stores nothing (below).           |
| `DATA_DIR`      | `/data`                          | Where the SQLite file lives (`sqlite` storage only): mount a volume there.                                           |
| `MCP`           | `on` with storage, `off` without | The MCP endpoint on `/mcp`. It works on stored documents, so `STORAGE=none` with `MCP=on` refuses to start.          |
| `MAX_DOCUMENTS` | `500`                            | Shared Projects held in memory at once; past it, a new share is refused and the app says the server is busy.         |
| `TRUST_PROXY`   | unset                            | Set to `true` only behind a reverse proxy that sets `X-Forwarded-For`, so the per-address limits see real addresses. |

Two examples:

- `docker-compose.yml`: Shared Projects stored in a volume, MCP on.
- `docker-compose.public.yml`: a public relay, nothing stored, MCP off.

Behind a reverse proxy, pass WebSocket upgrades on `/sync` through, keep the `Host` header (or set `X-Forwarded-Host`), and set `TRUST_PROXY=true`: the server refuses WebSocket upgrades whose `Origin` names another host. Caddy's `reverse_proxy` does all of this by default.

### Relay mode (`STORAGE=none`)

The server keeps nothing on disk. A Shared Project lives in its memory only while at least one Participant has it open, and is forgotten when the last one leaves. Every Participant keeps the Project in their browser; the first one back brings it to the server again, and what each did meanwhile merges.

What people see: a Share link opens only while someone has the Project open; otherwise the page says so. Local Projects are unchanged. Nothing is lost while one Participant still has their copy, but nobody but the Participants holds one: exporting a Project as JSON is the only backup.

Limits that bound a public server: 5 MB per document, 50 connections and 30 new shares per hour per address, `MAX_DOCUMENTS` documents in memory.

## MCP

With storage on, agents read and edit Shared Projects given their Share link, and draw System design diagrams as SVG:

```sh
claude mcp add --transport http simple-modelisation http://localhost:3000/mcp
```
