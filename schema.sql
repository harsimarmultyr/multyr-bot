-- ─────────────────────────────────────────────────────────────────────
-- Multyr DeFi Risk Lens Bot — Supabase Schema
-- Run this in the Supabase SQL Editor to set up all tables.
-- ─────────────────────────────────────────────────────────────────────

-- 1. Users
-- Tracks every Telegram user who has interacted with the bot.
create table if not exists users (
  id               bigserial primary key,
  telegram_id      bigint unique not null,
  username         text,
  first_name       text,
  last_seen_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- 2. Commands
-- Log of every command invocation for engagement analytics.
create table if not exists commands (
  id               bigserial primary key,
  user_telegram_id bigint not null references users(telegram_id) on delete cascade,
  chat_id          bigint not null,
  command          text not null,
  args             text,
  executed_at      timestamptz not null default now()
);

create index if not exists commands_user_idx on commands(user_telegram_id);
create index if not exists commands_command_idx on commands(command);
create index if not exists commands_executed_at_idx on commands(executed_at desc);

-- 3. Watchlist
-- Markets/strategies saved by admins for community tracking.
create table if not exists watchlist (
  id          bigserial primary key,
  protocol    text not null,
  asset       text not null,
  chain       text not null default 'arbitrum',
  note        text,
  added_by    bigint not null,  -- telegram user id of admin who added it
  created_at  timestamptz not null default now()
);

-- 4. Market Snapshots
-- Point-in-time market data fetched during /check calls.
create table if not exists market_snapshots (
  id           bigserial primary key,
  protocol     text not null,
  asset        text not null,
  chain        text not null,
  supply_apy   text,
  borrow_apy   text,
  utilization  text,
  tvl          text,
  source       text,
  fetched_at   timestamptz not null default now()
);

create index if not exists snapshots_protocol_asset_idx on market_snapshots(protocol, asset, chain);
create index if not exists snapshots_fetched_at_idx on market_snapshots(fetched_at desc);

-- 5. Feedback
-- Optional: users can submit feedback via a future /feedback command.
create table if not exists feedback (
  id               bigserial primary key,
  user_telegram_id bigint,
  message          text not null,
  created_at       timestamptz not null default now()
);

-- 6. Admin Users
-- Persistent admin list (complements ADMIN_TELEGRAM_IDS env var).
-- Env var takes precedence; this table is for runtime admin management.
create table if not exists admin_users (
  id           bigserial primary key,
  telegram_id  bigint unique not null,
  username     text,
  added_by     bigint,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────
-- RLS: Disabled for all tables (bot uses service role key which bypasses
-- RLS anyway, but disable explicitly to avoid confusion).
-- ─────────────────────────────────────────────────────────────────────
alter table users          disable row level security;
alter table commands       disable row level security;
alter table watchlist      disable row level security;
alter table market_snapshots disable row level security;
alter table feedback       disable row level security;
alter table admin_users    disable row level security;

-- ─────────────────────────────────────────────────────────────────────
-- Useful analytics queries (comments only, not executed)
-- ─────────────────────────────────────────────────────────────────────
-- Top commands by usage:
--   select command, count(*) from commands group by command order by count desc;
--
-- Daily active users:
--   select date_trunc('day', executed_at), count(distinct user_telegram_id)
--   from commands group by 1 order by 1 desc;
--
-- Most checked markets:
--   select protocol, asset, chain, count(*) from market_snapshots
--   group by 1,2,3 order by count desc limit 20;
