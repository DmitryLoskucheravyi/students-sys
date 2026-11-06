# Лише API: інтерфейс живе на Vercel, тому збірка клієнта тут не потрібна.
FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY server ./server
# Тимчасова папка завантажень: звідси файли їдуть у S3-сховище.
RUN mkdir -p uploads && chown node:node uploads
USER node

ENV HOST=0.0.0.0
ENV PORT=10000
EXPOSE 10000
CMD ["node", "server/index.js"]
