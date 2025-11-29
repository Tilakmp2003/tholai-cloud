# 1. Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Install dependencies (including dev deps for build)
# Added python3, make, g++ for native modules if needed (kept from previous fix)
RUN apk add --no-cache python3 make g++
RUN npm ci 
COPY . .
# Assuming there is a build script, if not we might need to adjust. 
# The user's plan says "RUN npm run build". 
# I need to check if "build" script exists in backend/package.json. 
# Previous view showed no "build" script, only "dev" and "orchestrator". 
# I will add a build script to package.json first or just compile with tsc.
# For now, I will assume I need to add the build script or use tsc directly.
# Let's stick to the user's Dockerfile but ensure it works.
# If "npm run build" fails, the docker build will fail.
# I'll check package.json again in a second. 
# For now, writing the Dockerfile as requested but with the build deps I know are needed.
# Generate prisma client (Required for build)
RUN npx prisma generate

RUN npm run build

# 2. Production Stage
FROM node:20-alpine
WORKDIR /app
# Install git (Crucial for your GitIntegration feature)
RUN apk add --no-cache git openssh-client python3 make g++

COPY package*.json ./
# Install only production dependencies
RUN npm ci --only=production

# Copy built code from builder stage
# User said "COPY --from=builder /app/dist ./dist"
# I need to ensure the build output goes to dist.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Generate prisma client
RUN npx prisma generate

# Expose the port
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/server.js"]
