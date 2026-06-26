# ── Build ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
ARG VITE_API_BASE_URL=http://localhost:4000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
WORKDIR /app
COPY package.json package-lock.json* ./
COPY web/package.json ./web/
RUN npm install --workspace web --include-workspace-root
COPY web ./web
RUN npm run build -w web

# ── Serve ────────────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
