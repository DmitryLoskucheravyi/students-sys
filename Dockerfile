# Лише API (NestJS): інтерфейс живе на Vercel, тому збірка клієнта тут не потрібна.

# 1. Компіляція TypeScript
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.server.json ./
COPY server ./server
RUN npx tsc -p tsconfig.server.json

# 2. Робочий образ: лише залежності для запуску й зібраний код
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=build /app/dist ./dist
# Схему бази сервер читає під час старту.
COPY server/schema.sql ./server/schema.sql
# Тимчасова папка завантажень: звідси файли їдуть у сховище.
RUN mkdir -p uploads && chown node:node uploads
USER node

ENV HOST=0.0.0.0
ENV PORT=10000
EXPOSE 10000
CMD ["node", "dist/server/main.js"]
