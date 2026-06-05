// src/commands/yield.ts
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

export async function handleYield(ctx: CommandContext<Context>): Promise<void> {
  const from = ctx.from;
  const rawArgs = (ctx.match ?? "").trim();

  if (from) {
    await logCommand({
      userId: from.id,
      username: from.username,
      firstName: from.first_name,
      chatId: ctx.chat.id,
      command: "/yield",
      args: rawArgs,
    });
  }

  if (!rawArgs) {
    await ctx.reply(
      "Usage: /yield [asset]\n\nExamples:\n/yield USDC\n/yield ETH\n/yield WBTC\n\nShows the best rate for that asset across all chains.\n\nNot financial advice."
    );
    return;
  }

  const loadingMsg = await ctx.reply(`Searching best rates for ${rawArgs.toUpperCase()} across all chains...`);

  try {
    const res = await fetch(DEFILLAMA_POOLS, {
      headers: { "User-Agent": "MultyrBot/1.0" },
    });

    try {
      await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    } catch {
      // ignore
    }

    if (!res.ok) {
      await ctx.reply("Rate data temporarily unavailable. Please try again shortly.\n\nNot financial advice.");
      return;
    }

    const json = (await res.json()) as { data: LlamaPool[] };
    const pools = json.data ?? [];

    const assetLower = rawArgs.toLowerCase();

    // Filter pools that match the asset symbol (case insensitive, partial match)
    const matching = pools.filter(
      (p) =>
        p.symbol.toLowerCase().includes(assetLower) &&
        p.apy != null &&
        p.apy > 0
    );

    if (matching.length === 0) {
      await ctx.reply(
        `No yield data found for "${rawArgs.toUpperCase()}". Try another symbol like USDC, ETH, WBTC.\n\nNot financial advice.`
      );
      return;
    }

    // Group by chain — keep only the highest APY pool per chain
    const byChain = new Map<string, LlamaPool>();
    for (const pool of matching) {
      const existing = byChain.get(pool.chain);
      if (!existing || (pool.apy ?? 0) > (existing.apy ?? 0)) {
        byChain.set(pool.chain, pool);
      }
    }

    // Sort chains by APY descending, take top 8
    const sorted = Array.from(byChain.values())
      .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
      .slice(0, 8);

    const lines = sorted.map((p) => {
      const apy =
        p.apyBase != null
          ? `${p.apyBase.toFixed(2)}%`
          : `${p.apy.toFixed(2)}%`;
      const tvl = p.tvlUsd != null ? formatUSD(p.tvlUsd) : "n/a";
      const chain = p.chain.padEnd(12, " ");
      return `${chain} ${apy} — ${p.project} (${tvl} TVL)`;
    });

    await ctx.reply(
      `${rawArgs.toUpperCase()} — best rate per chain\n\n` +
        lines.join("\n") +
        "\n\n" +
        "Moving cross-chain requires bridging. Factor in bridge fees and time before chasing a higher rate.\n\n" +
        "Not financial advice."
    );
  } catch {
    try {
      await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    } catch {
      // ignore
    }
    await ctx.reply("Rate data temporarily unavailable. Please try again shortly.\n\nNot financial advice.");
  }
}
