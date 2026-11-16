#!/usr/bin/env bash
# One-shot installer for Paconia on the Hostinger VPS (Ubuntu). Run as root from /opt/paconia:
#   bash deploy/bootstrap.sh paconia.com you@email.com
# Works next to Kraftshed and the Triagon ERP: if a Caddy container already fronts the server it joins
# Caddy's network and adds a site block; on a plain server it sets up Nginx + certbot instead.
set -euo pipefail
DOMAIN="${1:?Usage: bootstrap.sh <domain> <email-for-ssl>}"
EMAIL="${2:?Usage: bootstrap.sh <domain> <email-for-ssl>}"
cd "$(dirname "$0")/.."

echo "==> [1/6] Base tools"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get install -y -qq ca-certificates curl git openssl >/dev/null
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh >/dev/null

CADDY="$(docker ps --format '{{.Names}} {{.Image}}' | awk '/caddy/{print $1; exit}')"
if [ -n "$CADDY" ]; then
  MODE=caddy
  CADDY_NET="$(docker inspect "$CADDY" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')"
  CADDYFILE="$(docker inspect "$CADDY" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')"
  [ -n "$CADDYFILE" ] || { echo "!! Found Caddy container '$CADDY' but could not locate its Caddyfile mount. Aborting."; exit 1; }
  echo "    Existing Caddy detected: $CADDY (network: $CADDY_NET) — Paconia will be added behind it"
elif ss -ltnp | grep -q ':80 ' && ! ss -ltnp | grep ':80 ' | grep -q nginx; then
  echo "!! Port 80 is owned by something other than Nginx or Caddy. Aborting."; exit 1
else
  MODE=nginx
  apt-get install -y -qq nginx certbot python3-certbot-nginx >/dev/null
  if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 'Nginx Full' >/dev/null || true; fi
fi
if [ -f .env ] && grep -q '^APP_PORT=' .env; then
  APP_PORT="$(grep -E '^APP_PORT=' .env | cut -d'"' -f2)"
else
  APP_PORT=3000; while ss -ltn | grep -q ":${APP_PORT} "; do APP_PORT=$((APP_PORT+1)); done
fi
export APP_PORT
echo "    Mode: $MODE · app on 127.0.0.1:${APP_PORT}"

echo "==> [2/6] Writing .env"
if [ ! -f .env ]; then
  cat > .env <<ENV
DATABASE_URL="postgresql://paconia:$(openssl rand -hex 16)@db:5432/paconia?schema=public"
AUTH_SECRET="$(openssl rand -base64 32)"
NEXT_PUBLIC_SITE_URL="https://${DOMAIN}"
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""
PAYMENTS_DEMO="0"
UPLOAD_DIR="/app/uploads"
OWNER_EMAIL="owner@${DOMAIN}"
OWNER_PASSWORD="$(openssl rand -base64 12 | tr -d '/+=')"
SEED_DEMO="0"
APP_PORT="${APP_PORT}"
ENV
  chmod 600 .env
  echo "    .env created"
else
  echo "    .env already exists, keeping it"
fi
export POSTGRES_PASSWORD="$(grep -E '^DATABASE_URL=' .env | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')"

echo "==> [3/6] Web server"
if [ "$MODE" = caddy ]; then
  cat > docker-compose.override.yml <<YML
services:
  web:
    networks: [default, front]
networks:
  front:
    external: true
    name: ${CADDY_NET}
YML
  if ! grep -q "paconia-web:3000" "$CADDYFILE"; then
    cp "$CADDYFILE" "${CADDYFILE}.bak-$(date +%Y%m%d%H%M%S)"
    cat >> "$CADDYFILE" <<CADDY

# Paconia (added by paconia/deploy/bootstrap.sh)
www.${DOMAIN} {
    redir https://${DOMAIN}{uri} permanent
}

${DOMAIN} {
    encode gzip
    request_body {
        max_size 50MB
    }
    reverse_proxy paconia-web:3000
}
CADDY
    echo "    Site block added to $CADDYFILE (backup kept next to it)"
  fi
else
  sed -e "s/paconia.example/${DOMAIN}/g" -e "s/127.0.0.1:3000/127.0.0.1:${APP_PORT}/" deploy/nginx.conf > /etc/nginx/sites-available/${DOMAIN}
  ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}
  nginx -t -q && systemctl reload nginx
fi

echo "==> [4/6] Building and starting (3-6 minutes)"
docker compose build -q web tools
docker compose up -d db
sleep 5
docker compose run --rm tools npx prisma migrate deploy
docker compose up -d web

echo "==> [5/6] Owner login, catalogue, materials and machines"
docker compose run --rm tools npx tsx prisma/seed.ts

echo "==> [6/6] HTTPS"
if [ "$MODE" = caddy ]; then
  docker exec "$CADDY" caddy validate --config /etc/caddy/Caddyfile >/dev/null && docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile \
    && echo "    Caddy reloaded — it gets the SSL certificate once DNS for ${DOMAIN} points here"
else
  certbot --nginx --non-interactive --agree-tos -m "${EMAIL}" -d "${DOMAIN}" -d "www.${DOMAIN}" --redirect || echo "    (SSL skipped — DNS may not point here yet. Re-run: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN})"
fi

echo
echo "================================================================"
echo " Paconia is live:  https://${DOMAIN}"
echo " Staff desk:       https://${DOMAIN}/desk"
echo " Owner login:      $(grep OWNER_EMAIL .env | cut -d'"' -f2)  /  $(grep OWNER_PASSWORD .env | cut -d'"' -f2)"
echo " Change that password after first sign-in (Desk → Settings → Team)."
echo " Online payments: add Razorpay keys with  nano .env  then  ./deploy/deploy.sh"
echo " Nightly backups:  see DEPLOY.md (deploy/backup.sh)"
echo "================================================================"
