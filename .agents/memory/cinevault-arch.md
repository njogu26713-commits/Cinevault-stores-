---
name: CineVault architecture decisions
description: Key non-obvious decisions for the CineVault movie marketplace (MongoDB, M-Pesa, Telegram Bot).
---

## Database: MongoDB not PostgreSQL
The user explicitly requested MongoDB. The `lib/db` (Drizzle/Postgres) package is NOT used. Mongoose is installed directly in `artifacts/api-server`.

**Why:** User request; flexible movie metadata schema.

**How to apply:** All models live in `artifacts/api-server/src/models/`. Do not touch `lib/db`.

## Payment flow
STK Push → M-Pesa pings buyer → buyer enters PIN → Daraja POSTs to `/api/payments/mpesa/callback` → backend verifies and delivers.

**Why:** This is Safaricom Daraja's standard C2B STK Push pattern.

**How to apply:** MPESA_CALLBACK_URL must be public HTTPS (deployed URL). In sandbox, use the Daraja sandbox URLs; in production set MPESA_ENV=production.

## Callback idempotency (critical)
The callback handler uses atomic `findOneAndUpdate` with `{ status: "payment_initiated" }` guard + terminal-state early return to prevent duplicate delivery on callback replays.

**Why:** Daraja can send callbacks multiple times on network errors.

**How to apply:** Never use simple `order.save()` in callback — always use atomic conditional update.

## Telegram delivery prerequisite
Buyers must `/start` the bot before purchase. The bot cannot initiate DMs to users who haven't messaged it first (Telegram restriction).

**Why:** Telegram privacy rules — bots can only message users who initiated contact.

**How to apply:** Show this warning in the checkout modal so buyers know to start the bot first.

## Seed data
`POST /api/seed` only seeds if the DB is empty (safe to call repeatedly). Uses TMDB poster URLs.

## ObjectId validation
All route handlers that call `findById` validate with `mongoose.isValidObjectId()` first, returning 400 not 500 on invalid IDs.
