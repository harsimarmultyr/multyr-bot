// src/commands/rates.ts
import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";
import { formatUSD } from "../lib/defi";

const DEFILLAMA_POOLS = "https://yields.llama.fi/pools";

interface LlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number | null;
}

/**
 * Fetches top pools by APY for a given chain.
 * Exported so the digest job can call it directly.
 */
export async function fetchTopRates(chain: string, limit: number): Promise<string> {
  try {
    const res = await fetch(DEFILLAMA_POOLS, {
      headers: { "User-Agent": "MultyrBot/1.0" },
    });
    if (!res.ok) return "Rate data temporarily unavailable.";

    const json = (await res.json()) as { data: LlamaPool[] };
    const pools = json.data ?? [];

    const chainNorm = chain.toLowerCase();
    const filtered = pools
      .filter((p) => p.chain.toLowerCase() === chainNorm && p.apy != null && p.apy > 0)
      .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
      .slice(0, limit);

    if (filtered.length === 0) {
      return `No rate data found for chain: ${chain}.`;
    }

    const lines = filtered.map((p, i) => {
      const apy =
        p.apyBase != null
          ? `${p.apyBase.toFixed(2)}%`
          : `${p.apy.toFixed(2)}%`;
      const tvl = p.tvlUsd != null ? formatUSD(p.tvlUsd) : "n/a";
      return `${i + 1}. ${p.symbol} — ${p.project}\n   Supply: ${apy} | TVL: ${tvl}`;
    });

    return lines.join("\n\n");
  } catch {
    return "Rate data temporarily unavailable.";
  }
}

export async function handleRates(ctx: CommandContext<Context>): Promise<void> {
  const from = ctx.from;

  if (from) {
    await logCommand({
      userId: from.id,
      username: from.username,
      firstName: from.first_name,
      chatId: ctx.chat.id,
      command: "/rates",
      args: "",
    });
  }

  const loadingMsg = await ctx.reply("Fetching top Arbitrum rates...");

  const ratesText = await fetchTopRates("Arbitrum", 10);

  try {
    await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
  } catch {
    // ignore
  }

  await ctx.reply(
    "Top Arbitrum rates right now\n\n" +
      ratesText +
      "\n\n" +
      "Rates update every few hours from DefiLlama. Higher APY may include token incentives — check source before depositing.\n\n" +
      "Not financial advice."
  );
}
