# ─────────────────────────────────────────────────────────────────────────────
# Build estatico controlado do SPA (corrige o "stale chunk apos deploy").
# O servidor default do Nixpacks fazia fallback SPA amplo: /assets/*.js inexistente
# voltava como index.html (text/html) => erro de MIME. Aqui o nginx (ver nginx.conf)
# devolve 404 real para /assets ausente e serve o index.html sem cache.
#
# ATENCAO (Dokploy): VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY sao inlinadas
# em BUILD-TIME pelo Vite. Configure-as como BUILD ARGS no Dokploy. Se faltarem, o
# build FALHA de proposito (nao sobe app sem backend) e o container atual segue no ar.
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1 AS build
WORKDIR /app

# Instala dependencias com o lockfile congelado (projeto vive de bun).
COPY package.json bun.lock* bun.lockb* ./
RUN bun install --frozen-lockfile

COPY . .

# Envs de build-time (Vite). Dokploy deve passar como build args.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG SOURCE_COMMIT
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV SOURCE_COMMIT=$SOURCE_COMMIT

# Guard: sem a config do Supabase, falha o build (evita subir app sem backend).
RUN test -n "$VITE_SUPABASE_URL" || (echo "ERRO build: VITE_SUPABASE_URL ausente — configure como build arg no Dokploy" && exit 1)
RUN test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" || (echo "ERRO build: VITE_SUPABASE_PUBLISHABLE_KEY ausente — configure como build arg no Dokploy" && exit 1)

RUN bun run build

# ─── Serve ───────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
