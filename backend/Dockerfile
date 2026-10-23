# SolShield backend. Build context must be the REPO ROOT so the sibling
# `shared/` package (imported via the @shared tsconfig path) is available.
#   docker build -f backend/Dockerfile -t solshield-backend .
FROM node:20-slim

WORKDIR /app

# Install backend deps (shared has no runtime deps of its own).
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev || (cd backend && npm install --omit=dev)

# Copy source for backend + shared.
COPY shared ./shared
COPY backend ./backend

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

WORKDIR /app/backend
# tsx runs the TypeScript directly; env comes from the container environment.
CMD ["npx", "tsx", "src/server.ts"]
