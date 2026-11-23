#!/bin/sh
# Deploys the hosted LIKYLY MCP (mcp.likyly.com) on the droplet (SSH host "do-deployer"). The
# image is built here (linux/amd64) and loaded there: the droplet already has its base layers
# (same node:22 alpine as the website), so only the server's own layers travel, and nothing is
# built on the droplet's small Docker disk. The Caddy site (caddy.site) is added once, by hand.
set -e
cd "$(dirname "$0")/.."
DEST=app/likyly-mcp
docker build --platform linux/amd64 -t likyly-mcp:latest .
docker save likyly-mcp:latest | gzip | ssh do-deployer "docker load"
ssh do-deployer "mkdir -p $DEST"
rsync -az deploy/compose.yaml do-deployer:$DEST/compose.yaml
ssh do-deployer "cd $DEST && docker compose up -d && docker image prune -f >/dev/null"
sleep 4
ssh do-deployer "docker exec likyly-mcp wget -qO- http://127.0.0.1:3200/health"; echo
