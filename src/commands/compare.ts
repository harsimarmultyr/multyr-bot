import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";
import { fetchComparison, MarketData } from "../lib/defi";

function parseArgs(raw: string): { assetA: string; assetB: string; protocol: string; chain: string } {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const knownProtocols = ["aave", "compound", "morpho", "euler", "fluid", "spark"];
  const knownChains = ["arbitrum", "ethereum", "mainnet", "polygon", "base", "optimism", "bsc"];

  let protocol = "";
  let chain = "";
  const assets: string[] = [];

  for (const t of tokens) {
    const tl = t.toLowerCase();
    if (!protocol && knownProtocols.some((p) => tl.includes(p))) {
      protocol = t;
    } else if (!chain && knownChains.some((c) => tl.includes(c))) {
      chain = t;
    } else {
      assets.push(t);
    }
  }

  return {
    assetA: assets[0] || "USDC",
    assetB: assets[1] || "DAI",
    protocol: protocol || "aave",
    chain: chain || "arbitrum",
  };
}

function winner(a: MarketData | null, b: MarketData | null, field: "supplyApy" | "borrowApy" | "utilization"): string {
  if (!a || !b) return "n/a";
  const av = parseFloat(a[field]);
  const bv = parseFloat(b[field]);
  if (isNaN(av) || isNaN(bv)) return "n/a";
  if (field === "borrowApy") return av < bv ? a.asset : b.asset;
  if (field === "utilization") return av < bv ? `${a.asset} (more available)` : `${b.asset} (more available)`;
  return av > bv ? a.asset : b.asset;
}

export async function handleCompare(ctx: CommandContext<Context>): Promise<void> {
  const from = ctx.from;
  const rawArgs = ctx.match ?? "";

  if (from) {
    await logCommand({
      userId: from.id,
      username: from.username,
      firstName: from.first_name,
      chatId: ctx.chat.id,
      command: "/compare",
      args: rawArgs,
    });
  }

  if (!rawArgs.trim()) {
    await ctx.reply(`Usage: /compare [assetA] [assetB] [protocol] [chain]\nExample: /compare USDC DAI Aave Arbitrum`);
    return;
  }

  const { assetA, assetB, protocol, chain } = parseArgs(rawArgs);
  const loadingMsg = await ctx.reply(`Comparing ${assetA} vs ${assetB} on ${protocol} (${chain})...`);

  const [dataA, dataB] = await fetchComparison(assetA, assetB, protocol, chain);

  try {
    await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
  } catch {}

  if (!dataA && !dataB) {
    await ctx.reply(`No data found for ${assetA} or ${assetB}. Try: /compare USDC DAI Aave Arbitrum`);
    return;
  }

  const notFound: string[] = [];
  if (!dataA) notFound.push(assetA);
  if (!dataB) notFound.push(assetB);

  await ctx.reply(
    `Comparison: ${dataA?.asset ?? assetA} vs ${dataB?.asset ?? assetB}\n` +
      `Protocol: ${protocol} | Chain: ${chain}\n\n` +
      `Supply APY: ${dataA?.supplyApy ?? "n/a"} vs ${dataB?.supplyApy ?? "n/a"}\n` +
      `Higher supply: ${winner(dataA, dataB, "supplyApy")}\n\n` +
      `Borrow APY: ${dataA?.borrowApy ?? "n/a"} vs ${dataB?.borrowApy ?? "n/a"}\n` +
      `Cheaper to borrow: ${winner(dataA, dataB, "borrowApy")}\n\n` +
      `Utilization: ${dataA?.utilization ?? "n/a"} vs ${dataB?.utilization ?? "n/a"}\n` +
      `More liquidity: ${winner(dataA, dataB, "utilization")}\n\n` +
      `TVL: ${dataA?.tvl ?? "n/a"} vs ${dataB?.tvl ?? "n/a"}\n\n` +
      `Higher utilization means more capital at work but tighter exit liquidity. Lower borrow APY is better for borrowers. High supply APY can mean real demand or inflated incentives - check the yield source.\n\n` +
      (notFound.length > 0 ? `No data found for: ${notFound.join(", ")}\n\n` : "") +
      `Not financial advice. Data from DefiLlama.`
  );
}
