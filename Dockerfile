# Stage 1: Build Frontend SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend Server
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production-only dependencies for backend
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend --only=production

# Copy compiled backend source files and Prisma artifacts
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/prisma ./backend/prisma
COPY --from=backend-builder /app/backend/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=backend-builder /app/backend/node_modules/@prisma/client ./backend/node_modules/@prisma/client

# Copy built frontend static resources
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 5000

# Start unified Express server + Sockets
CMD ["node", "backend/dist/server.js"]
