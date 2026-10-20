# Shaders Hero Section

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/josephhyphening-4663s-projects/v0-shaders-hero-section)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/ShjQgMgtfrt)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/josephhyphening-4663s-projects/v0-shaders-hero-section](https://vercel.com/josephhyphening-4663s-projects/v0-shaders-hero-section)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/projects/ShjQgMgtfrt](https://v0.app/chat/projects/ShjQgMgtfrt)**

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

* npm
  ```sh
  npm install npm@latest -g
  ```

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/your_username_/your_project_name.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Copy `.env.example` to `.env.local` and fill in your Cashfree keys (see below).
4. Start the app: `npm run dev`. The SQLite database is created automatically at `data/muse.db`.
5. Create an admin account (after the app has started once):
   ```sh
   node scripts/create-admin.mjs "Your Name" you@example.com 'a-strong-password'
   ```

### Payments (Cashfree)

Booking links create a Cashfree Payment Link per booking. In the Cashfree dashboard, enable
webhooks for payment links and point them to `<SITE_URL>/api/cashfree/webhook`. The post-payment
page also checks the link status directly, so bookings settle even if a webhook is delayed.

### Requirements

Node.js 22.5+ (uses the built-in `node:sqlite`). Because data lives in a local file, deploy to a
server with persistent disk (not serverless).

## Testing

There are no tests yet. Please add tests for any new features or bug fixes.

## Linting

To run the linter, use the following command:

```sh
npm run lint
```

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository
