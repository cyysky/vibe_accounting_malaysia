# --- deps ---
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --no-audit --no-fund --workspaces --include-workspace-root


# --- build ---
FROM node:20-alpine AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY apps ./apps
COPY packages ./packages

# Build shared first so its dist is available for both web transpile and api
RUN npm --workspace packages/shared run build
RUN npm --workspace apps/web run build


# --- prod deps ---
FROM node:20-alpine AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --no-audit --no-fund --workspaces --include-workspace-root --omit=dev


# --- run ---
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000

COPY --from=build /repo/apps/web/.next ./apps/web/.next
COPY --from=build /repo/apps/web/public ./apps/web/public
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/packages ./packages
COPY --from=build /repo/apps/web/package.json ./apps/web/package.json

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
