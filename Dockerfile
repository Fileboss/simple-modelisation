# Build the app, then run one Node server that serves it and syncs Shared Projects (ADR 0003).
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
COPY packages/model/package.json packages/model/
# Node 26 no longer ships corepack: install the pnpm version package.json pins.
RUN npm install -g "$(node -p "require('./package.json').packageManager")"
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:26-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
COPY packages/model/package.json packages/model/
# The server and the shared model package only; the model stays a workspace
# symlink, since Node does not run TypeScript from node_modules (ADR 0004).
RUN npm install -g "$(node -p "require('./package.json').packageManager")" \
	&& pnpm install --prod --frozen-lockfile --filter "@simple-modelisation/server..."
COPY server/src server/src
COPY packages/model/src packages/model/src
COPY --from=build /app/dist server/public
ENV PORT=3000 DATA_DIR=/data STATIC_DIR=/app/server/public
# Owned by node so a fresh named volume is writable.
RUN mkdir /data && chown node:node /data
VOLUME /data
EXPOSE 3000
USER node
WORKDIR /app/server
CMD ["node", "src/main.ts"]
