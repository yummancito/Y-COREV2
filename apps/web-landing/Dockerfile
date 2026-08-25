# Dockerfile — apps/web-landing
#
# Para qué sirve: fija el entorno de build de la landing (versión de Node y de
# pnpm) para que "funciona en mi PC" no vuelva a pasar. Se ejecuta desde la
# raíz del monorepo (necesita ver pnpm-workspace.yaml y los packages
# compartidos como @ycore/tsconfig).
#
# Build:  docker build -f apps/web-landing/Dockerfile -t ycore-web-landing .
# Salida: /app/apps/web-landing/dist servido por el stage "export".

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@11.15.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web-landing/package.json apps/web-landing/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
RUN pnpm install --frozen-lockfile --filter @ycore/web-landing...

FROM deps AS build
COPY packages/tsconfig packages/tsconfig
COPY apps/web-landing apps/web-landing
RUN pnpm --filter @ycore/web-landing build

# Stage final: solo el HTML/CSS estático generado, sin Node ni node_modules.
FROM scratch AS export
COPY --from=build /repo/apps/web-landing/dist /dist
