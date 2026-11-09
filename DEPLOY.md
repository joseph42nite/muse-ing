# Deploying Muse-ing

Live site: **https://muse-ing.in** (also `www.muse-ing.in`). Admin panel: **https://admin.muse-ing.in**.

## Push an update

From the project folder on a machine whose SSH key is on the server:

```bash
scripts/deploy.sh
```

This runs typecheck and lint, copies the working copy to the server, installs dependencies, builds, restarts the app and checks that `/`, `/login` and the admin guard respond. Pass `--skip-checks` to skip typecheck/lint. It deploys **what is in your folder**, committed or not, so run `npm test` first for anything risky.

Never copied: `node_modules`, `.next`, `data/`, `*.db`, `.env*`, `.git`. The live database and secrets stay on the server.

## Server

| | |
|---|---|
| Host | Utho Cloud VPS, Bangalore, `root@150.241.246.95` (SSH key only) |
| OS | Ubuntu 24.04, Node 24 (NodeSource apt repo) |
| App code | `/srv/muse/app`, owned by the `muse` system user |
| Database | `/srv/muse/data/muse.db` (SQLite, WAL) |
| Secrets / env | `/srv/muse/muse.env` (root:muse, 640) |
| Server-side build script | `/srv/muse/deploy.sh` (`npm ci --include=dev`, `npm run build`, restart) |
| Last build log | `/srv/muse/last-deploy.log` |
| Service | systemd `muse`, `next start` on `127.0.0.1:3000` |
| Proxy / SSL | Nginx site `/etc/nginx/sites-available/muse`; Let's Encrypt via Certbot, auto-renews (`certbot.timer`) |
| Firewall | ufw: SSH, HTTP, HTTPS only |
| Backups | `/etc/cron.d/muse-backup`: nightly 03:30 to `/srv/muse/backups/muse-YYYY-MM-DD.db`, kept 14 days |

## Environment

`/srv/muse/muse.env` holds `NODE_ENV=production`, `DATABASE_PATH`, `NEXT_PUBLIC_SITE_URL=https://muse-ing.in`, and the Cashfree (`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`) and `YOUTUBE_API_KEY` secrets. Edit it on the server, never commit it. `NEXT_PUBLIC_*` values are baked in at build time, so after changing env run:

```bash
ssh root@150.241.246.95 /srv/muse/deploy.sh
```

Demo data is off in production (`SEED_DEMO_DATA` unset), so there are no demo logins.

## Common tasks

Create an admin (prompts; password not saved in shell history):

```bash
ssh -t root@150.241.246.95 'read -p "Name: " n; read -p "Email: " e; read -s -p "Password: " p; echo; cd /srv/muse/app && sudo -u muse DATABASE_PATH=/srv/muse/data/muse.db node scripts/create-admin.mjs "$n" "$e" "$p"'
```

Logs, status, restart:

```bash
ssh root@150.241.246.95 journalctl -u muse -n 100 --no-pager
```
```bash
ssh root@150.241.246.95 systemctl restart muse
```

Download a database backup:

```bash
scp root@150.241.246.95:/srv/muse/backups/muse-$(date +%F).db .
```

Roll back: there is no release history on the server. Check out (or restore) the previous code locally and run `scripts/deploy.sh` again. The database is not touched by a deploy; schema changes in `lib/server/db.ts` only add tables/columns.

## Admin panel (admin.muse-ing.in)

The same app serves the admin panel on its own host. `proxy.ts` maps `/` to `/admin` and `/login` to the admin sign-in (`/admin-login`) when the host is in `ADMIN_HOSTS` (default `admin.muse-ing.in,admin.localhost`); other public pages redirect to `/`. Locally, open http://admin.localhost:3000.

- DNS: an `A` record `admin` → `150.241.246.95` at GoDaddy (the domain's nameservers are `domaincontrol.com`).
- Nginx: `/etc/nginx/sites-available/muse-admin` (linked in `sites-enabled`), proxying to the same app.
- SSL, once DNS resolves: `ssh root@150.241.246.95 certbot --nginx -d admin.muse-ing.in --redirect`
- Optional: set `ADMIN_ORIGIN=https://admin.muse-ing.in` in `muse.env` and restart, so `muse-ing.in/admin` redirects there.

Sessions are per host, so admins sign in on the admin host separately. Create admin logins with the command under Common tasks.

## Gotchas

- `npm ci` must use `--include=dev`: with `NODE_ENV=production` it otherwise skips TypeScript and PostCSS, and the build fails with "Can't resolve '@/components/…'".
- The bare IP returns 404; Nginx only answers for the domain names.
- Cashfree webhooks should point at `https://muse-ing.in/api/cashfree/webhook`.
