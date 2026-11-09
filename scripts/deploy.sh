#!/bin/sh
# Push the current working copy to the live server and restart it.
# Usage: scripts/deploy.sh [--skip-checks]
# Needs SSH key access to root@$DEPLOY_HOST. See DEPLOY.md.
set -eu

HOST="${DEPLOY_HOST:-root@150.241.246.95}"
SITE="${DEPLOY_SITE:-https://muse-ing.in}"
cd "$(dirname "$0")/.."

if [ "${1:-}" != "--skip-checks" ]; then
  echo "==> Typecheck and lint"
  npm run typecheck
  npm run lint
fi

echo "==> Copying code to $HOST:/srv/muse/app"
# Never copied: dependencies, build output, local databases, secrets.
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .swc \
  --exclude data --exclude '*.db' --exclude '*.db-*' \
  --exclude '.env*' --exclude .git --exclude .claude \
  --exclude '*.tsbuildinfo' --exclude .DS_Store \
  ./ "$HOST:/srv/muse/app/"

echo "==> Installing, building and restarting on the server"
ssh "$HOST" 'chown -R muse:muse /srv/muse/app && /srv/muse/deploy.sh > /srv/muse/last-deploy.log 2>&1 \
  || { tail -40 /srv/muse/last-deploy.log; exit 1; }; sleep 4; systemctl is-active muse'

echo "==> Smoke test"
fail=0
for path in / /login; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$SITE$path")
  echo "  $path $code"; [ "$code" = 200 ] || fail=1
done
code=$(curl -s -o /dev/null -w "%{http_code}" "$SITE/api/admin/stats")
echo "  /api/admin/stats $code (expect 403)"; [ "$code" = 403 ] || fail=1

[ "$fail" = 0 ] && echo "==> Live at $SITE" || { echo "==> Smoke test failed; check: ssh $HOST journalctl -u muse -n 100"; exit 1; }
