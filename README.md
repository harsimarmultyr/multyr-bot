# Multyr DeFi Risk Lens Bot

A Telegram bot for the Multyr community. Gives DeFi users a reason to return to the group by surfacing live lending market data, risk checklists, and side-by-side comparisons — without making financial recommendations.

---

## Commands

| Command | Who | Description |
|---|---|---|
| `/start` | Anyone | Show available commands |
| `/redflags` | Anyone | Universal DeFi red flag checklist |
| `/check [protocol] [asset] [chain]` | Anyone | Risk breakdown for a specific market |
| `/compare [assetA] [assetB] [protocol] [chain]` | Anyone | Side-by-side market comparison |
| `/watchlist` | Anyone | View saved markets |
| `/watchlist add [protocol] [asset] [chain] [note]` | Admins | Add a market to the watchlist |
| `/watchlist remove [id]` | Admins | Remove a watchlist entry |
| `/poll` | Admins | Post a DeFi discussion poll |

---

## Stack

- **Runtime:** Node.js 18+ / TypeScript
- **Bot framework:** [grammY](https://grammy.dev/)
- **Hosting:** Vercel (serverless webhook)
- **Database:** Supabase (Postgres)
- **Data:** [DefiLlama Yields API](https://yields.llama.fi/)

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/your-org/multyr-bot
cd multyr-bot
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in all values
```

Set `BOT_MODE=polling` for local dev (no webhook needed).

### 3. Run

```bash
npm run dev
```

---

## Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`.
3. Copy your **Project URL** and **service_role key** from Project Settings → API.
4. Add both to your `.env`.

---

## Vercel Deployment

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "init: multyr defi risk lens bot"
git remote add origin https://github.com/your-org/multyr-bot
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your repo.
2. Framework preset: **Other**.
3. Root directory: `/` (leave default).

### 3. Add environment variables in Vercel

Go to **Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From BotFather |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service_role key |
| `ADMIN_TELEGRAM_IDS` | Comma-separated Telegram user IDs |
| `BOT_MODE` | `webhook` |
| `WEBHOOK_URL` | Your Vercel deployment URL (e.g. `https://multyr-bot.vercel.app`) |
| `DUNE_API_KEY` | Optional — for future Dune integration |

### 4. Deploy

Click **Deploy** in Vercel. After the build succeeds, copy your deployment URL.

### 5. Register the Telegram webhook

```bash
export TELEGRAM_BOT_TOKEN=your_token
export WEBHOOK_URL=https://your-deployment.vercel.app
node scripts/register-webhook.js
```

You should see: `✅ Webhook registered successfully.`

Verify it worked:
```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

---

## Telegram Bot Creation

1. Open Telegram and message [@BotFather](https://t.me/botfather).
2. Send `/newbot` and follow the prompts.
3. Copy the token into `TELEGRAM_BOT_TOKEN`.
4. Add the bot to your Multyr group and make it an admin (needed for polls).
5. To get your Telegram user ID: message [@userinfobot](https://t.me/userinfobot).

---

## Finding Admin Telegram IDs

Message [@userinfobot](https://t.me/userinfobot) on Telegram. It will return your numeric user ID. Add comma-separated IDs to `ADMIN_TELEGRAM_IDS`.

---

## Data Sources

Current MVP uses:
- **DefiLlama Yields API** — free, no key required, covers Aave, Compound, Morpho, Euler, Fluid, and hundreds more

Planned integrations (future sprints):
- Dune Analytics API (set `DUNE_API_KEY`)
- Aave V3 subgraph
- Morpho API
- Compound III API

---

## Analytics Queries (Supabase)

**Top commands by usage:**
```sql
select command, count(*) from commands group by command order by count desc;
```

**Daily active users:**
```sql
select date_trunc('day', executed_at) as day, count(distinct user_telegram_id) as dau
from commands group by 1 order by 1 desc;
```

**Most checked markets:**
```sql
select protocol, asset, chain, count(*) from market_snapshots
group by 1,2,3 order by count desc limit 20;
```

---

## Project Structure

```
multyr-bot/
├── src/
│   ├── index.ts              # Entry point, webhook/polling mode
│   ├── commands/
│   │   ├── start.ts
│   │   ├── redflags.ts
│   │   ├── check.ts
│   │   ├── compare.ts
│   │   ├── poll.ts
│   │   └── watchlist.ts
│   └── lib/
│       ├── supabase.ts       # Supabase client
│       ├── defi.ts           # DefiLlama data fetching
│       ├── logger.ts         # Command usage logging
│       └── admin.ts          # Admin ID check
├── supabase/
│   └── schema.sql            # Full DB schema
├── scripts/
│   └── register-webhook.js   # One-time webhook registration
├── .env.example
├── vercel.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## Disclaimer

This bot does not provide financial advice. All data is informational only. Always do your own research before allocating capital.
