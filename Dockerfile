# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage — Astro SSR (Node standalone adapter) + Playwright Chromium
# for handdrawn-mode rendering. We use the official Playwright Node image
# because it ships chromium + all OS-level deps preconfigured.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
