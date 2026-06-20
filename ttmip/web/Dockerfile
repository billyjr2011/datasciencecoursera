# Static frontend served by nginx. The dashboard is a zero-build single page,
# so we just copy it in and let nginx proxy /api to the backend.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY js /usr/share/nginx/html/js
EXPOSE 80
