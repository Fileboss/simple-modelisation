# syntax=docker/dockerfile:1
# Build the app, then run one Node server that serves it and syncs Shared Projects (ADR 0003).
# The base is pinned by digest; Dependabot proposes the updates.
FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
COPY packages/model/package.json packages/model/
# Node 26 no longer ships corepack: install the pnpm version package.json pins.
RUN npm install -g "$(node -p "require('./package.json').packageManager")"

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# The server and the shared model package only; the model stays a workspace
# symlink, since Node does not run TypeScript from node_modules (ADR 0004).
FROM base AS deps
RUN pnpm install --prod --frozen-lockfile --filter "@simple-modelisation/server..."

FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5
# The runtime needs Node only: no package manager to run, nor to patch.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
		/usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
		/opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
	# Owned by node so a fresh named volume is writable.
	&& mkdir /data && chown node:node /data
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/server/node_modules server/node_modules
COPY --from=deps /app/packages/model/node_modules packages/model/node_modules
COPY package.json ./
COPY server/package.json server/
COPY packages/model/package.json packages/model/
COPY server/src server/src
COPY packages/model/src packages/model/src
COPY --from=build /app/dist server/public
ENV PORT=3000 DATA_DIR=/data STATIC_DIR=/app/server/public
VOLUME /data
EXPOSE 3000
USER node
WORKDIR /app/server
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --start-interval=2s --retries=3 \
	CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "src/main.ts"]
