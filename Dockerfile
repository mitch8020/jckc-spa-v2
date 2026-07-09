# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS backend-deps
WORKDIR /app/jckc-spa-backend
COPY jckc-spa-backend/package*.json ./
RUN npm ci

FROM node:24-bookworm-slim AS frontend-deps
WORKDIR /app/jckc-spa-frontend
COPY jckc-spa-frontend/package*.json ./
RUN npm ci

FROM backend-deps AS backend-build
COPY jckc-spa-backend ./
RUN npm run build

FROM frontend-deps AS frontend-build
COPY jckc-spa-frontend ./
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY jckc-spa-backend/package*.json ./jckc-spa-backend/
COPY jckc-spa-frontend/package*.json ./jckc-spa-frontend/
RUN cd jckc-spa-backend \
  && npm ci --omit=dev --ignore-scripts \
  && npm cache clean --force
RUN cd jckc-spa-frontend \
  && npm ci --omit=dev --ignore-scripts \
  && npm cache clean --force

COPY --from=backend-build /app/jckc-spa-backend/dist ./jckc-spa-backend/dist
COPY --from=frontend-build /app/jckc-spa-frontend/dist ./jckc-spa-frontend/dist

USER node
CMD ["node", "jckc-spa-backend/dist/main.js"]
