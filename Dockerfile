# Build the app, then run one Node server that serves it and syncs Shared Projects (ADR 0003).
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
# Node 26 no longer ships corepack: install the pnpm version package.json pins.
RUN npm install -g "$(node -p "require('./package.json').packageManager")"
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# A standalone copy of the server with its production dependencies only.
RUN pnpm deploy --filter @simple-modelisation/server --prod --legacy /server

FROM node:26-alpine
WORKDIR /server
COPY --from=build /server ./
COPY --from=build /app/dist ./public
ENV PORT=3000 DATA_DIR=/data STATIC_DIR=/server/public
# Owned by node so a fresh named volume is writable.
RUN mkdir /data && chown node:node /data
VOLUME /data
EXPOSE 3000
USER node
CMD ["node", "src/main.ts"]
