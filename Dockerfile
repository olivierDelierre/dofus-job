# --- Build : dépendances, icônes (téléchargées depuis DofusDB) et front ---
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Les icônes ne sont pas versionnées (~120 Mo) : on les récupère d'après public/data/game.json.
RUN node scripts/fetch-data.mjs --icons-only && npm run build

# --- Runtime : API Node + front compilé ---
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    API_PORT=3001 \
    DB_PATH=/data/data.db \
    NODE_NO_WARNINGS=1 \
    PUID=1000 \
    PGID=1000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
# Démarre en root pour rendre /data à PUID:PGID, puis le serveur abandonne les droits root (server/privileges.js).
VOLUME /data
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.API_PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
