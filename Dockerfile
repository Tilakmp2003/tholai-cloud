# Stage 0: build image
FROM node:20.14.0 AS builder

# Install build essentials for node-pty
RUN apt-get update && apt-get install -y build-essential python3 python3-dev

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/
COPY backend/tsconfig.json ./backend/

# Install dependencies
WORKDIR /app/backend
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# Force rebuild of native modules (like node-pty) for Linux
# Force rebuild of native modules (like node-pty) for Linux
RUN npm install --build-from-source --legacy-peer-deps

# Copy full backend source (excluding node_modules via .dockerignore, but just in case)
COPY backend/ .

# Generate Prisma Client
RUN npx prisma generate --schema=./prisma/schema.prisma

# Build the application
RUN npm run build

# Stage 1: runtime image
FROM node:20.14.0-slim

WORKDIR /app

# Install runtime dependencies (openssl for Prisma, git for git features, procps for ps)
RUN apt-get update && apt-get install -y openssl git procps && rm -rf /var/lib/apt/lists/*

# Copy built artifacts and production dependencies from builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/backend/prisma ./backend/prisma

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Run migrations then start server
CMD ["sh", "-c", "cd backend && npx prisma migrate deploy && node dist/server.js"]
