# Hosted LIKYLY MCP service (Streamable HTTP, mcp.likyly.com). Stateless, holds no secrets: each request
# brings an OAuth access token (Claude, ChatGPT) or a LIKYLY key.
# Same base as the website image on the droplet: its layers are already there, a deploy only
# sends the server's own (the droplet's Docker disk is small).
FROM node:22.23.5-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22.23.5-alpine3.24
WORKDIR /app
ENV NODE_ENV=production PORT=3200
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY assets ./assets
EXPOSE 3200
CMD ["node", "dist/http.js"]
