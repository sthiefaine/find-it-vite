# ---- Build ----
FROM node:22-alpine AS build
WORKDIR /app

RUN npm install -g pnpm@10.28.2

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- Serve the site and online rooms ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production TRUST_PROXY=1 MULTIPLAYER_DIST=/usr/share/nginx/html
RUN apk add --no-cache nginx tini && npm install -g pnpm@10.28.2
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY nginx.conf /etc/nginx/http.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src

EXPOSE 80 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1

ENTRYPOINT ["/sbin/tini", "-g", "--"]
CMD ["node", "/app/server/start-container.mjs"]
