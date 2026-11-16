# simple-modelisation

<!-- sdlc:begin (generated from .sdlc.yml, edit there then run /sdlc:sync) -->

## Workflow (sdlc)

Stack profiles: node-ts-pnpm. Active modules: spec, plan, decisions, review, commit, release, ci, docker, pr, handoff.

Each BACKLOG.md item goes through these phases: spec -> plan -> implement -> review -> commit. Releases are project-wide, not per item.

- `.sdlc/state.json` holds the current item and phase. Change it only through `sdlc:next` (a phase transition; at a gate, the user runs it); commit it with the work. `/sdlc:quick <slug>` starts an item that skips spec and plan.
- On a new session, read `.sdlc/state.json` and BACKLOG.md first, then resume where they say.

Gates: one stop per item, before the commit phase. Move through the earlier phases on your own (calling `sdlc:next` yourself), keeping each one short, and summarise what they produced when you stop. Never push to `main`, tag a release or change a data schema without approval.

## Scope: 80/20 at the start only

- Project start (scaffolding and the first version, while BACKLOG.md's Done section is empty): apply 80/20. Aim for the 20% of effort that gives 80% of the result: the smallest working version of the core use case, defaults over configuration, edge cases and polish written down in BACKLOG.md instead of built.
- Iterations (from the first Done item on): drop 80/20. Each item is finished properly: its edge cases, errors and tests are part of it, not a later item. Keep items small rather than half-done.

## Commands

Use the Makefile entry points, never the underlying tools directly: `make dev`, `make test`, `make lint`, `make build`.
Run `make lint test` before declaring work done.

## Conventions

- Write everything in English: code, comments, commits, docs, BACKLOG.md. The user may write in French; answer in French.
- Commit messages: `Scope: imperative description`, the scope a capitalised word (`Auth: add SameSite cookie`, `Backlog: mark M11 done`). Prefix a milestone id when there is one (`M11.1: ...`). One logical change per commit.
- Git: trunk-based on `main` unless the `pr` module is active. Pushing to `main` needs the user's explicit request; other branches may be pushed.
- Never read or write `.env` files; `.env.example` is the committed template.
- Versions: when creating the project or adding a runtime, framework, tool or Docker base image, take the most recent LTS (the most recent stable release where there is no LTS: Python, Go, Rust). Look it up online, never from memory: memory is out of date. The runtime is pinned in its version file (`.nvmrc`, `.python-version`, `.java-version`, the `go` line of `go.mod`), which CI reads; keep Docker base images and `engines` fields in line with it.
- Security: `.github/workflows/security.yml` (Trivy on dependencies, gitleaks on the history) must stay green. Fix a HIGH or CRITICAL finding by updating the dependency; merge Dependabot's weekly PRs rather than letting them pile up. GitHub Actions are pinned by commit, with the version in a comment.

## Docs for humans (read in Obsidian)

Human docs are `docs/**`, BACKLOG.md, CHANGELOG.md, GLOSSARY.md and README.md (not AGENTS.md or CLAUDE.md). The user reads them in Obsidian, so:

- Start each with YAML frontmatter: `title`, `tags` (a list), `date` (YYYY-MM-DD, creation), and `status` where it means something (`draft`, `accepted`, `done`). README.md has none: GitHub would show it as a table.
- Link with relative markdown links (`[ADR 0001](../adr/0001-x.md)`), never `[[wikilinks]]`, so links work in Obsidian, on GitHub and for agents.
- Use Obsidian callouts (`> [!note]`, `> [!warning]`) for asides and mermaid for diagrams.

### Module: spec

Before any code for an item, grill the user on what is unclear with the `sdlc:grilling` skill (`sdlc:grill-with-docs` when the decisions module is on), then write the spec with `sdlc:to-spec`. Keep it proportionate: for a small item, a spec fits on one screen (problem, solution, acceptance criteria), with user stories only where they say something the solution does not. Ask only the questions you cannot settle from the code. Specs and tickets live in local markdown: see `docs/agents/issue-tracker.md`. A quick item (`/sdlc:quick`) skips this phase.

### Module: plan

Break the approved spec into tracer-bullet tickets with `sdlc:to-tickets`, written under `docs/specs/<item-slug>/issues/` (see `docs/agents/issue-tracker.md`). One ticket is a fine answer for a small item. Implement them frontier first: a ticket whose blockers are all done. A quick item skips this phase.

### Module: decisions

Decisions costly to reverse (architecture, dependency, data model) become ADRs in `docs/adr/`, and domain terms go to `GLOSSARY.md`, both through `sdlc:domain-modeling`. See `docs/agents/domain.md`.

### Module: review

Before committing an item, review the diff with Claude Code's built-in `code-review` skill. Fix the findings or list the ones left open for the user.

### Module: commit

At the commit phase, propose the commit message(s) for the item following the conventions above, then commit once approved (or directly when gates is none). Move the item to "Done" in BACKLOG.md in the same commit.

### Module: release

Versions follow semver, tagged `vX.Y.Z`, with a CHANGELOG.md entry per release. Release with `/sdlc:release`: it proposes the bump and the entry, and asks once. Pushing the tag always needs the user's request.

### Module: ci

`.github/workflows/ci.yml` runs `make lint test` on pushes to `main` and on pull requests. Keep CI calling the Makefile, never tools directly; when a stack needs a new setup step, add it to the workflow.

### Module: docker

Pushing a `vX.Y.Z` tag builds the root `Dockerfile` and publishes `ghcr.io/<owner>/<repo>:X.Y.Z` (`.github/workflows/docker.yml`). Write the Dockerfile when it is first needed: multi-stage, minimal runtime image, no secrets baked in.

### Module: pr

Work on a topic branch per item, named in kebab-case without prefix (`session-cookie`). Write the PR body with the `sdlc:pr` skill and open it with `gh pr create`; merge with a merge commit, not a squash.

### Module: handoff

When a session ends mid-item, make sure `.sdlc/state.json` and the ticket `Status:` lines say exactly where the work stands. For a longer break, the user runs `/sdlc:handoff`.
<!-- sdlc:end -->

## Project notes

Lightweight, collaborative web app for developers: System design diagrams (Components with market-product Skins) and MCDs (Merise, Looping look). Read GLOSSARY.md for the vocabulary and docs/adr/ before touching the document model or the canvas.

- Stack: Vite + React 19 + TypeScript, pnpm. Canvas: React Flow (ADR 0002). Data: each Project is a Yjs document persisted in IndexedDB (ADR 0001); the UI changes it only through the Project document module.
- TypeScript stays on 6: typescript-eslint does not support 7 yet. The Vite template's oxlint was dropped for sdlc's ESLint config; React rules live in its last block.
- `.sdlc/` is in .prettierignore: sdlc rewrites state.json in its own format.
- UI strings are English and kept together, ready for a French translation.
- pnpm workspace: the app at the root, the sync server in `server/` (Hocuspocus, SQLite through `node:sqlite`, ADR 0003). The server runs TypeScript directly with Node 26 (`node src/main.ts`, imports with `.ts`); configured by `PORT`, `DATA_DIR`, `STATIC_DIR` and `TRUST_PROXY` (true only behind a proxy that sets X-Forwarded-For). `server/src/protocol.ts` is shared with the app. `make dev` runs Vite and the server together; Vite proxies `/sync`.
- One Docker image serves the app and the sync; `docker-compose.yml` is the example deployment.
