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

In development the database is seeded with demo artists, gigs and requests (demo artist:
`artist@museing.com` / `artist123`). A production build doesn't seed unless you set `SEED_DEMO_DATA=true`.

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

**Tips and dedications (Cashfree).** Tips and ₹50 dedications also go through Cashfree Payment
Links, on the same webhook. Each payment is a row in `gateway_payments` until Cashfree reports it
paid; it then becomes a paid `artist_transactions` row, and a dedication jumps the queue straight
away. The live page also asks Cashfree directly when the audience returns from checkout, so a late
webhook doesn't hold anything up.

Muse-ing collects the money and pays each artist their share. The platform fee is set in
**Admin → Settings** (10% to start) and applies to ticket sales, tips and dedications alike: the
buyer pays the listed price and the fee comes out of the promoter's or artist's share. Each booking
and payment keeps the rate it started with. The artist sees what they keep in the console's Money
tab, and the admin Artists page shows what's still to be paid out, with a **Mark paid** action once
you've transferred it. Without Cashfree keys, a development server replaces the tip and dedication
checkout with a local link that marks the payment paid, so the flow can be tried end to end.

**Coupons.** Admin → Coupons makes discount codes for an artist (their gigs) or a promoter (any
gig; sales count for them), with code ideas built from the name. Each code takes a percentage off
and covers a set number of tickets; a booking needing more than are left gets no discount. Seats
count when paid and are held for 30 minutes during checkout. A 100% code confirms the booking free.

**Door list.** The venue portal (Guests tab on each gig) and Admin → Events → Guests list every
booking with name and phone, with **Paid** (for anyone who pays at the door) and **Arrived**
switches.

Older direct-UPI payments still waiting for an artist to confirm can be marked **Received** or
**Not received** in the console as before.

## Deployment

Data lives in a local SQLite file, so deploy to a server with a persistent disk (not serverless).
