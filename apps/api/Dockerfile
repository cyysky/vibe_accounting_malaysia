# syntax=docker/dockerfile:1.7
#
# Prisma client needs openssl at runtime on alpine.
# npm hoists all workspace dependencies into /app/node_modules (the root),
# so we read everything from there, not /app/apps/api/node_modules.

# --- deps (install ALL deps so prisma generate + nest build work) ---
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
# Copy the full set of manifest files needed for the install
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/nest-cli.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
ARG CACHEBUST=2
RUN echo "CACHEBUST=$CACHEBUST" && npm install --no-audit --no-fund --legacy-peer-deps --install-strategy=hoisted

# --- builder (compile shared + api, run prisma generate) ---
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=deps /app/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --from=deps /app/apps/api/nest-cli.json ./apps/api/nest-cli.json
COPY --from=deps /app/package.json ./package.json
ARG CACHEBUST_SRC=2
RUN echo "CACHEBUST_SRC=$CACHEBUST_SRC"
COPY packages ./packages
COPY apps ./apps
WORKDIR /app/packages/shared
RUN npx tsc -p tsconfig.json
WORKDIR /app/apps/api
# Generate the Prisma client
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npx nest build

# --- prod-deps (prune devDependencies) ---
FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
ARG CACHEBUST=2
RUN echo "CACHEBUST=$CACHEBUST" && npm install --no-audit --no-fund --omit=dev --legacy-peer-deps


# --- tester (run unit tests with all devDeps) ---
FROM node:22-alpine AS tester
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY packages ./packages
COPY apps ./apps
WORKDIR /app/packages/shared
RUN npx tsc -p tsconfig.json
WORKDIR /app/apps/api
RUN npx prisma generate --schema=prisma/schema.prisma
CMD ["npx", "jest", "--colors=false"]

# --- runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat tini curl

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder  /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder  /app/apps/api/dist ./apps/api/dist
COPY --from=builder  /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder  /app/apps/api/package.json ./apps/api/package.json
# Generated Prisma client lives under node_modules/@prisma + node_modules/.prisma
COPY --from=builder  /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder  /app/node_modules/.prisma ./node_modules/.prisma

WORKDIR /app/apps/api
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
