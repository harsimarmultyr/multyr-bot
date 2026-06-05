// src/commands/unlock.ts
import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";
import { formatUSD } from "../lib/defi";

const DEFILLAMA_EMISSION_BASE = "https://api.llama.fi/emission";

// Hardcoded slugs to check — keep this list short for latency
const PROTOCOL_SLUGS: string[] = [
  "aave",
  "curve-dao",
  "convex-finance",
  "pendle",
  "maker",
  "uniswap",
  "arbitrum",
  "optimism",
  "gmx",
  "lido",
];

const DAYS_AHEAD = 14;

interface EmissionEvent {
  timestamp: number;
  noOfTokens: number[];
  description?: string;
}

interface EmissionSection {
  label: string;
  token: string;
  maxSupply?: number;
  circSupply?: number;
  events?: EmissionEvent[];
}

interface EmissionData {
  name?: string;
  token?: string;
  tokenPrice?: { price: number } | null;
  events?: EmissionEvent[];
  chains?: EmissionSection[];
  schedule?: EmissionEvent[];
  circSupply?: number;
  maxSupply?: number;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface UnlockEntry {
  protocol: string;
  token: string;
  dateStr: string;
  amount: number;
  type: "cliff" | "linear" | "unknown";
  supplyPercent: string;
  priceUsd: number | null;
}

async function fetchProtocolUnlocks(slug: string, now: number, cutoff: number): Promise<UnlockEntry[]> {
  try {
    const res = await fetch(`${DEFILLAMA_EMISSION_BASE}/${slug}`, {
      headers: { "User-Agent": "MultyrBot/1.0" },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as EmissionData;

    // Gather all events — DefiLlama structure varies by protocol
    const allEvents: Array<{ ts: number; tokens: number; isCliff: boolean }> = [];
    const circSupply = data.circSupply ?? 0;
    const priceUsd = data.tokenPrice?.price ?? null;
    const tokenName = data.token ?? slug.toUpperCase();
    const protocolName = data.name ?? slug;

    // Top-level schedule
    if (Array.isArray(data.schedule)) {
      for (const ev of data.schedule) {
        if (ev.timestamp > now && ev.timestamp <= cutoff) {
          const amount = Array.isArray(ev.noOfTokens)
            ? ev.noOfTokens.reduce((s: number, v: number) => s + v, 0)
            : 0;
          allEvents.push({ ts: ev.timestamp, tokens: amount, isCliff: true });
        }
      }
    }
    // Top-level events array
    if (Array.isArray(data.events)) {
      for (const ev of data.events) {
        if (ev.timestamp > now && ev.timestamp <= cutoff) {
          const amount = Array.isArray(ev.noOfTokens)
            ? ev.noOfTokens.reduce((s: number, v: number) => s + v, 0)
            : 0;
          allEvents.push({ ts: ev.timestamp, tokens: amount, isCliff: false });
        }
      }
    }
    // Per-chain sections
    if (Array.isArray(data.chains)) {
      for (const section of data.chains) {
        if (Array.isArray(section.events)) {
          for (const ev of section.events) {
            if (ev.timestamp > now && ev.timestamp <= cutoff) {
              const amount = Array.isArray(ev.noOfTokens)
                ? ev.noOfTokens.reduce((s: number, v: number) => s + v, 0)
                : 0;
              allEvents.push({ ts: ev.timestamp, tokens: amount, isCliff: false });
            }
          }
        }
      }
    }

    if (allEvents.length === 0) return [];

    // Aggregate all amounts found within window (could be multiple events)
    const totalTokens = allEvents.reduce((s, e) => s + e.tokens, 0);
    const earliestTs = Math.min(...allEvents.map((e) => e.ts));
    const hasCliff = allEvents.some((e) => e.isCliff);

    const supplyPercent =
      circSupply > 0
        ? `~${((totalTokens / circSupply) * 100).toFixed(1)}% of circulating supply`
        : "supply% unavailable";

    return [
      {
        protocol: protocolName,
        token: tokenName,
        dateStr: formatDate(earliestTs),
        amount: totalTokens,
        type: hasCliff ? "cliff" : "linear",
        supplyPercent,
        priceUsd,
      },
    ];
  } catch {
    // Silently skip protocols that fail
    return [];
  }
}

export async function handleUnlock(ctx: CommandContext<Context>): Promise<void> {
  const from = ctx.from;

  if (from) {
    await logCommand({
      userId: from.id,
      username: from.username,
      firstName: from.first_name,
      chatId: ctx.chat.id,
      command: "/unlock",
      args: "",
    });
  }

  const loadingMsg = await ctx.reply("Checking upcoming token unlocks...");

  const now = Math.floor(Date.now() / 1000);
  const cutoff = now + DAYS_AHEAD * 24 * 60 * 60;

  const results = await Promise.all(
    PROTOCOL_SLUGS.map((slug) => fetchProtocolUnlocks(slug, now, cutoff))
  );

  try {
    await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
  } catch {
    // ignore
  }

  const entries: UnlockEntry[] = results.flat();

  if (entries.length === 0) {
    await ctx.reply(
      "No major unlocks detected in the next 14 days across tracked protocols.\n\n" +
        "Note: Large unlocks can create selling pressure on reward tokens.\n\n" +
        "Not financial advice."
    );
    return;
  }

  // Sort by date
  entries.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  const lines: string[] = ["Upcoming token unlocks — next 14 days\n"];

  for (const entry of entries) {
    const amountStr =
      entry.amount > 0
        ? entry.amount >= 1e6
          ? `${(entry.amount / 1e6).toFixed(1)}M tokens`
          : entry.amount >= 1e3
          ? `${(entry.amount / 1e3).toFixed(0)}K tokens`
          : `${entry.amount.toFixed(0)} tokens`
        : "amount unavailable";

    const usdValue =
      entry.priceUsd != null && entry.amount > 0
        ? ` (${formatUSD(entry.amount * entry.priceUsd)} at current price)`
        : "";

    lines.push(`${entry.token} (${entry.protocol}) — ${entry.dateStr}`);
    lines.push(`  ${amountStr} unlocking (${entry.type})${usdValue}`);
    lines.push(`  ${entry.supplyPercent}`);
    lines.push("");
  }

  lines.push("Note: Large unlocks can create selling pressure on reward tokens.\n\nNot financial advice.");

  await ctx.reply(lines.join("\n"));
}
