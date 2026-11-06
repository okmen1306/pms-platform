FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY ../../shared /shared
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3010/health || exit 1
CMD ["node", "dist/server.js"]
