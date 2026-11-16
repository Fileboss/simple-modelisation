# Build the static app, then serve it with nginx. Node follows .nvmrc.
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# Node 26 no longer ships corepack: install the pnpm version package.json pins.
RUN npm install -g "$(node -p "require('./package.json').packageManager")"
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
