# ---- build stage (also used as the one-off "tools" container for migrations and seeding) ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate && npm run build:next

# ---- runtime stage ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 UPLOAD_DIR=/app/uploads
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN mkdir -p /app/uploads && chown -R app:app /app
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
