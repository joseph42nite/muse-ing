# Muse-ing

Live gigs where the room shapes the setlist: audiences upvote songs, send requests and paid
dedications, and tip the artist over UPI; artists run the set, the karaoke screen and synced lyrics
from one console; promoters sell tickets through Cashfree; venues check guests in at the door.

Originally scaffolded on [v0.app](https://v0.app/chat/projects/ShjQgMgtfrt).

## Getting started

Requires Node.js 22.13+ (the app uses the built-in `node:sqlite`).

```sh
npm install
cp .env.example .env.local   # fill in Cashfree / YouTube keys as needed
npm run dev
```

The SQLite database is created automatically at `data/muse.db` (override with `DATABASE_PATH`).

In development the database is seeded with demo artists, gigs and requests, and the login pages show
a one-click demo artist login. Neither happens in a production build unless you opt in with
`SEED_DEMO_DATA=true` and `NEXT_PUBLIC_DEMO_LOGIN=true`.

Create an admin account once the app has started at least once:

```sh
node scripts/create-admin.mjs "Your Name" you@example.com 'a-strong-password'
```

## Scripts

| Command             | What it does                    |
| ------------------- | ------------------------------- |
| `npm run dev`       | Dev server                      |
| `npm run build`     | Production build (type-checked) |
| `npm start`         | Serve the production build      |
| `npm run lint`      | ESLint                          |
| `npm run typecheck` | `tsc --noEmit`                  |
| `npm test`          | Jest                            |

## Payments

**Tickets (Cashfree).** Each booking gets a Cashfree Payment Link. In the Cashfree dashboard, enable
payment-link webhooks pointing to `<SITE_URL>/api/cashfree/webhook`. The post-payment page also
checks the link status directly, so bookings settle even if a webhook is late.

**Tips and dedications (direct UPI).** The audience pays the artist's own UPI ID through `upi://`
deep links. Direct UPI transfers send no confirmation back, so a payment the audience reports is
saved as `pending` and doesn't count until the artist checks their UPI app and marks it **Received**
in the console's Bank tab (dedications only jump the queue after that). **Not received** discards the
claim, and the audience member can pay again.

## Deployment

Data lives in a local SQLite file, so deploy to a server with a persistent disk (not serverless).
