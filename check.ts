import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";
import { fetchMarketData } from "../lib/defi";
import { supabase } from "../lib/supabase";

/**
 * Parse "/check Aave USDC Arbitrum" into { protocol, asset, chain }
 * Very liberal — tries to infer intent from 1–3 tokens.
 */
function parseArgs(raw: string): { protocol: string; asset: string; chain: string } {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  // heuristic: first token that looks like a protocol name
  const knownProtocols = ["aave", "compound", "morpho", "euler", "fluid", "dolomite", "venus", "spark"];
  const knownChains = ["arbitrum", "ethereum", "mainnet", "polygon", "base", "optimism", "bsc", "avalanche"];

  let protocol = "";
  let chain = "";
  const rest: string[] = [];

  for (const t of tokens) {
    const tl = t.toLowerCase();
    if (!protocol && knownProtocols.some((p) => tl.includes(p))) {
      protocol = t;
    } else if (!chain && knownChains.some((c) => tl.includes(c))) {
      chain = t;
    } else {
      rest.push(t);
    }
  }

  return {
    protocol: protocol || tokens[0] || "aave",
    asset: rest[0] || tokens[1] || "USDC",
    chain: chain || "arbitrum",
  };
}

function escapeMarkdown(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

export async function handleCheck(ctx: CommandContext<Context>): Promise<void> {
  const from = ctx.from;
  const rawArgs = ctx.match ?? "";

  if (from) {
    await logCommand({
      userId: from.id,
      username: from.username,
      firstName: from.first_name,
      chatId: ctx.chat.id,
      command: "/check",
      args: rawArgs,
    });
  }

  if (!rawArgs.trim()) {
    await ctx.reply(
      `Usage: /check \\[protocol\\] \\[asset\\] \\[chain\\]\n_Example: /check Aave USDC Arbitrum_`,
      { parse_mode: "MarkdownV2" }
    );
    return;
  }

  const { protocol, asset, chain } = parseArgs(rawArgs);
  const loadingMsg = await ctx.reply(`🔍 Checking ${asset} on ${protocol} (${chain})…`);

  const data = await fetchMarketData(asset, protocol, chain);

  // Save snapshot regardless
  if (data) {
    await supabase.from("market_snapshots").insert({
      protocol: data.protocol,
      asset: data.asset,
      chain: data.chain,
      supply_apy: data.supplyApy,
      borrow_apy: data.borrowApy,
      utilization: data.utilization,
      tvl: data.tvl,
      source: data.source,
      fetched_at: data.fetchedAt,
    });
  }

  // Delete the loading message (best-effort)
  try {
    await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
  } catch {}

  if (!data) {
    await ctx.reply(
      `⚠️ *No data found* for *${escapeMarkdown(asset)}* on *${escapeMarkdown(protocol)}* \\(${escapeMarkdown(chain)}\\)\\.\n\n` +
        `Try different spelling, e\\.g\\. /check Aave USDC Arbitrum\n\n` +
        `_Data pulled from DefiLlama\\. Not all markets are indexed\\._`,
      { parse_mode: "MarkdownV2" }
    );
    return;
  }

  // Basic red flag signals from data
  const flags: string[] = [];
  const utilRaw = parseFloat(data.utilization);
  if (!isNaN(utilRaw) && utilRaw > 90) flags.push("🔴 Utilization >90% — withdrawal liquidity may be tight");
  if (!isNaN(utilRaw) && utilRaw > 80 && utilRaw <= 90) flags.push("🟡 Utilization >80% — monitor for rate spikes");
  if (data.borrowApy !== "n/a") {
    const borrow = parseFloat(data.borrowApy);
    const supply = parseFloat(data.supplyApy);
    if (!isNaN(borrow) && !isNaN(supply) && borrow < supply) {
      flags.push("🟡 Borrow APY lower than supply APY — check for emission subsidies");
    }
  }
  if (flags.length === 0) flags.push("🟢 No automated flags from this data snapshot");

  const flagText = flags.map((f) => `• ${escapeMarkdown(f)}`).join("\n");

  await ctx.reply(
    `📊 *${escapeMarkdown(data.asset)}* on *${escapeMarkdown(data.protocol)}* \\(${escapeMarkdown(data.chain)}\\)\n\n` +
      `*Supply APY:* ${escapeMarkdown(data.supplyApy)}\n` +
      `*Borrow APY:* ${escapeMarkdown(data.borrowApy)}\n` +
      `*Utilization:* ${escapeMarkdown(data.utilization)}\n` +
      `*TVL:* ${escapeMarkdown(data.tvl)}\n` +
      `*Source:* ${escapeMarkdown(data.source)}\n\n` +
      `*Automated flags:*\n${flagText}\n\n` +
      `*What to check manually:*\n` +
      `• Oracle type and staleness risk\n` +
      `• Contract upgrade permissions and timelock\n` +
      `• Whether yield is from real fees or token incentives\n` +
      `• Collateral quality if this is a lending market\n\n` +
      `Use /redflags for the full checklist\\.\n\n` +
      `─────────────────\n` +
      `⚠️ _Not financial advice\\. Data from ${escapeMarkdown(data.source)}\\._`,
    { parse_mode: "MarkdownV2" }
  );
}
