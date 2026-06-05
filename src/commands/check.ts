import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";
import { fetchMarketData } from "../lib/defi";
import { supabase } from "../lib/supabase";

function parseArgs(raw: string): { protocol: string; asset: string; chain: string } {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
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
    await ctx.reply(`Usage: /check [protocol] [asset] [chain]\nExample: /check Aave USDC Arbitrum`);
    return;
  }

  const { protocol, asset, chain } = parseArgs(rawArgs);
  const loadingMsg = await ctx.reply(`Checking ${asset} on ${protocol} (${chain})...`);

  const data = await fetchMarketData(asset, protocol, chain);

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

  try {
    await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
  } catch {}

  if (!data) {
    await ctx.reply(
      `No data found for ${asset} on ${protocol} (${chain}).\n\n` +
        `Try different spelling, e.g. /check Aave USDC Arbitrum\n\n` +
        `Data pulled from DefiLlama. Not all markets are indexed.`
    );
    return;
  }

  const flags: string[] = [];
  const utilRaw = parseFloat(data.utilization);
  if (!isNaN(utilRaw) && utilRaw > 90) flags.push("HIGH ALERT: Utilization >90% - withdrawal liquidity may be tight");
  else if (!isNaN(utilRaw) && utilRaw > 80) flags.push("WARNING: Utilization >80% - monitor for rate spikes");
  if (data.borrowApy !== "n/a") {
    const borrow = parseFloat(data.borrowApy);
    const supply = parseFloat(data.supplyApy);
    if (!isNaN(borrow) && !isNaN(supply) && borrow < supply) {
      flags.push("WARNING: Borrow APY lower than supply APY - check for emission subsidies");
    }
  }
  if (flags.length === 0) flags.push("No automated flags from this data snapshot");

  await ctx.reply(
    `${data.asset} on ${data.protocol} (${data.chain})\n\n` +
      `Supply APY: ${data.supplyApy}\n` +
      `Borrow APY: ${data.borrowApy}\n` +
      `Utilization: ${data.utilization}\n` +
      `TVL: ${data.tvl}\n` +
      `Source: ${data.source}\n\n` +
      `Automated flags:\n${flags.map(f => `- ${f}`).join("\n")}\n\n` +
      `What to check manually:\n` +
      `- Oracle type and staleness risk\n` +
      `- Contract upgrade permissions and timelock\n` +
      `- Whether yield is from real fees or token incentives\n` +
      `- Collateral quality if this is a lending market\n\n` +
      `Use /redflags for the full checklist.\n\n` +
      `Not financial advice. Data from ${data.source}.`
  );
}
