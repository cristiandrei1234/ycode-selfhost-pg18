# Ycode app image — multi-stage build for self-hosting.
# Next.js is NOT built in `standalone` mode here, so the runner keeps the full
# node_modules (also needed by knex/ts-node to run migrations on startup).

# ---- deps: install all dependencies (incl. dev — needed for build + migrations)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Toolchain in case a native dep needs compiling (sharp ships prebuilt; be safe).
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the Next.js app
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# generateStaticParams() degrades to [] when no DB is reachable, so the build
# needs no database connection.
RUN npm run build

# ---- runner: serve the app (and apply migrations on startup)
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_NO_WARNINGS=1 \
    PORT=3002
# Non-standalone build: keep the whole app (full node_modules for ts-node/knex,
# the .next output, and source the migrations need).
COPY --from=builder /app ./
COPY docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && useradd -m -u 1001 ycode \
    && chown -R ycode:ycode /app
USER ycode
EXPOSE 3002
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "run", "start"]
