FROM node:20-alpine AS deps

RUN apk add --no-cache openssl libc6-compat

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

RUN pnpm exec prisma generate

FROM deps AS build

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build

FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat tini

ENV NODE_ENV=production

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=deps /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma \
                 ./node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma

COPY --from=build /app/dist ./dist

RUN mkdir -p uploads && chown -R app:app uploads

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:${PORT:-3000}/health || exit 1


USER app
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]