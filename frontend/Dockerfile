# SolShield frontend. Build context must be the REPO ROOT so the sibling
# `shared/` package is available to Vite.
#   docker build -f frontend/Dockerfile -t solshield-frontend .
FROM node:20-slim AS build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && (npm ci || npm install)

COPY shared ./shared
COPY frontend ./frontend

# Vite inlines VITE_* vars at build time; pass them as build args.
ARG VITE_API_URL
ARG VITE_SOLANA_RPC
ARG VITE_SOLANA_CLUSTER
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOLANA_RPC=$VITE_SOLANA_RPC
ENV VITE_SOLANA_CLUSTER=$VITE_SOLANA_CLUSTER

RUN cd frontend && npm run build

# ---- serve ----
FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
