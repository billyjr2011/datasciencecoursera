# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Keep prod deps only; `tsx` is a prod dep so `prisma db seed` works in-container.
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist

EXPOSE 4000
# Apply migrations on boot, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
