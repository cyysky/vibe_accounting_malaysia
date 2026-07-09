# --- deps ---
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --no-audit --no-fund --workspaces --include-workspace-root


# --- build ---
FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY tsconfig.base.json* ./
COPY apps ./apps
COPY packages ./packages

# Build shared package first, then api (api imports its compiled JS)
RUN npm --workspace packages/shared run build
RUN npm --workspace apps/api run build


# --- prod deps only ---
FROM node:20-alpine AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --no-audit --no-fund --workspaces --include-workspace-root --omit=dev


# --- run ---
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
