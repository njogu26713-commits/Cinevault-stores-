# CineVault — Movie Marketplace

A premium dark Netflix-style movie marketplace where users browse, buy, and receive movie downloads. Payment via M-Pesa (Safaricom Daraja API). Delivery via Telegram Bot.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/movie-marketplace run dev` — run the frontend (port 21337)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `curl -X POST localhost:80/api/seed` — seed sample movies (only seeds if DB is empty)

## Required Secrets

| Key | Purpose |
|-----|---------|
| `MONGODB_URI` | MongoDB connection string (e.g. `mongodb+srv://...`) |
| `MPESA_CONSUMER_KEY` | Safaricom Daraja API consumer key |
| `MPESA_CONSUMER_SECRET` | Safaricom Daraja API consumer secret |
| `MPESA_SHORTCODE` | M-Pesa Business Short Code (Paybill/Till) |
| `MPESA_PASSKEY` | Lipa Na M-Pesa Online Passkey |
| `MPESA_CALLBACK_URL` | Public HTTPS URL for M-Pesa callbacks (e.g. `https://yourapp.replit.app/api/payments/mpesa/callback`) |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |

## Environment Variables (non-secret)

| Key | Value | Purpose |
|-----|-------|---------|
| `MPESA_ENV` | `sandbox` or `production` | Switches Daraja API base URL |
| `MARKETPLACE_BASE_PATH` | e.g. `/` | Optional override for the marketplace's Vite `base` (defaults to `/`) |
| `ADMIN_BASE_PATH` | e.g. `/admin/` | Optional override for the admin dashboard's Vite `base` (defaults to `/admin/`) |

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Framer Motion, TanStack Query
- API: Express 5
- DB: MongoDB + Mongoose
- Validation: Zod (server), generated Orval hooks (client)
- Payments: M-Pesa Daraja STK Push
- Delivery: Telegram Bot API (node-telegram-bot-api)
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas used by server routes
- `artifacts/api-server/src/models/` — Mongoose models (Movie, Order)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/services/` — mpesa.ts, telegram.ts
- `artifacts/movie-marketplace/src/` — React frontend

## Architecture decisions

- MongoDB (not PostgreSQL) — the user explicitly requested it for flexible movie metadata storage
- STK Push flow: frontend POSTs to `/api/orders` → backend calls Daraja → M-Pesa pings the buyer → callback hits `/api/payments/mpesa/callback` → movie delivered via Telegram
- Callback idempotency: atomic `findOneAndUpdate` with status guard prevents duplicate delivery on callback replays
- ObjectId validation at route boundary (before mongoose) to return 400 instead of 500 on bad IDs
- Amount verification in callback to detect tampered payloads
- Seed endpoint (`POST /api/seed`) only runs if DB is empty — safe to call repeatedly

## Product

- **Homepage**: Dark cinematic hero banner + genre filter pills + movie poster grid
- **Movie detail**: Full-width banner, embedded YouTube trailer, specs (quality/duration/size/price), Buy Now button
- **Checkout modal**: Telegram username + M-Pesa phone + Pay Now → redirects to order status page
- **Order status page**: Polls every 3s, shows animated stages (Initiated → Confirmed → Delivering → Delivered)
- **Purchase history**: Lookup by Telegram username, shows all past orders

## Telegram Bot Setup

1. Create a bot via @BotFather, get the token → set as `TELEGRAM_BOT_TOKEN`
2. Add the bot as admin to your private movie channel
3. Upload each movie to the channel, copy the file ID, save it in the movie's `telegramFileId` field via the API
4. Buyers must `/start` the bot before purchase so the bot can message them

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after editing `openapi.yaml`
- MPESA_CALLBACK_URL must be publicly reachable HTTPS — use the deployed URL, not localhost
- Telegram users must have started a conversation with the bot before purchase (bot can't initiate DMs)
- Seed movies use TMDB poster URLs — they work but require TMDB's CDN to be available
