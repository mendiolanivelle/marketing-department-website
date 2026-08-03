FROM node:22.13.0-alpine3.21 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ARG VITE_TURNSTILE_SITE_KEY=unset
ARG VITE_PRIVATE_STORAGE_ENABLED=false
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
ENV VITE_PRIVATE_STORAGE_ENABLED=$VITE_PRIVATE_STORAGE_ENABLED
RUN npm run build

FROM node:22.13.0-alpine3.21

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY --chown=node:node server ./server
COPY --chown=node:node --from=build /app/dist ./dist

EXPOSE 3000
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server/index.mjs"]
