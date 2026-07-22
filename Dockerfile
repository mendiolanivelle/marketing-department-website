FROM node:22.14.0-alpine3.21 AS build

WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps && rm -rf /root/.npm

COPY . .
RUN npm run build

FROM node:22.14.0-alpine3.21

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "server/index.mjs"]
