# syntax=docker/dockerfile:1
#
# S&J POS empaquetado para Docker (Fase 5). Una sola imagen corre en este equipo
# (Linux) y en una laptop con Windows 11 vía Docker Desktop. El servidor es Astro
# SSR en modo standalone (@astrojs/node) + SQLite (better-sqlite3).
#
# Nota sobre better-sqlite3: acá se compila contra el Node del contenedor (no contra
# el ABI de Electron), que fue justo lo que dejó trabado el empaquetado con Electron.

# ---- Etapa de build: compila el servidor y el módulo nativo ----
FROM node:22-bookworm AS build
WORKDIR /app

# Herramientas para compilar better-sqlite3 si no hay binario precompilado.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Etapa runtime: solo lo necesario para correr ----
FROM node:22-bookworm-slim AS run
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
# La base y los respaldos viven en un volumen montado, no dentro del contenedor.
ENV SJ_POS_DB_PATH=/datos/sj-pos.db
ENV SJ_POS_RESPALDOS_DIR=/datos/respaldos

# node_modules completo: trae el better-sqlite3 ya compilado y tsx (para migrar/sembrar).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/src ./src
COPY --from=build /app/seed ./seed
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /datos

EXPOSE 4321
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
