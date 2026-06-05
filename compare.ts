import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";
import { fetchComparison, MarketData } from "../lib/defi";

function escapeMarkdown(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

function parseArgs(raw: string): {
  assetA: string;
  assetB: string;
  protocol: string;
  chain: string;
} {
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

function winner(
  a: MarketData | null,
  b: MarketData | null,
  field: "supplyApy" | "borrowApy" | "utilization"
): string {
  if (!a || !b) return "n/a";
  const av = parseFloat(a[field]);
  const bv = parseFloat(b[field]);
  if (isNaN(av) || isNaN(bv)) return "n/a";
  if (field === "borrowApy") return av < bv ? `✅ ${a.asset}` : `✅ ${b.asset}`;
  if (field === "utilization") return av < bv ? `✅ ${a.asset} (more available)` : `✅ ${b.asset} (more available)`;
  return av > bv ? `✅ ${a.asset}` : `✅ ${b.asset}`;
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
    await ctx.reply(
      `Usage: /compare \\[assetA\\] \\[assetB\\] \\[protocol\\] \\[chain\\]\n_Example: /compare USDC DAI Aave Arbitrum_`,
      { parse_mode: "MarkdownV2" }
    );
    return;
  }

  const { assetA, assetB, protocol, chain } = parseArgs(rawArgs);
  const loadingMsg = await ctx.reply(`⚖️ Comparing ${assetA} vs ${assetB} on ${protocol} (${chain})…`);

  const [dataA, dataB] = await fetchComparison(assetA, assetB, protocol, chain);

  try {
    await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
  } catch {}

  if (!dataA && !dataB) {
    await ctx.reply(
      `⚠️ Could not find market data for *${escapeMarkdown(assetA)}* or *${escapeMarkdown(assetB)}*\\.\n\n` +
        `Check the spelling and try again\\. Example: /compare USDC DAI Aave Arbitrum`,
      { parse_mode: "MarkdownV2" }
    );
    return;
  }

  const notFound: string[] = [];
  if (!dataA) notFound.push(assetA);
  if (!dataB) notFound.push(assetB);
  const notFoundNote =
    notFound.length > 0
      ? `\n⚠️ _No data found for: ${notFound.map(escapeMarkdown).join(", ")}_\n`
      : "";

  const row = (label: string, a: string, b: string) =>
    `*${escapeMarkdown(label)}*\n  ${escapeMarkdown(a || "n/a")} vs ${escapeMarkdown(b || "n/a")}\n`;

  const supplyWin = winner(dataA, dataB, "supplyApy");
  const borrowWin = winner(dataA, dataB, "borrowApy");
  const utilWin = winner(dataA, dataB, "utilization");

  await ctx.reply(
    `⚖️ *Comparison: ${escapeMarkdown(dataA?.asset ?? assetA)} vs ${escapeMarkdown(dataB?.asset ?? assetB)}*\n` +
      `Protocol: ${escapeMarkdown(protocol)} \\| Chain: ${escapeMarkdown(chain)}\n\n` +
      row("Supply APY", dataA?.supplyApy ?? "n/a", dataB?.supplyApy ?? "n/a") +
      `  Higher supply: ${escapeMarkdown(supplyWin)}\n\n` +
      row("Borrow APY", dataA?.borrowApy ?? "n/a", dataB?.borrowApy ?? "n/a") +
      `  Cheaper to borrow: ${escapeMarkdown(borrowWin)}\n\n` +
      row("Utilization", dataA?.utilization ?? "n/a", dataB?.utilization ?? "n/a") +
      `  More liquidity available: ${escapeMarkdown(utilWin)}\n\n` +
      row("TVL", dataA?.tvl ?? "n/a", dataB?.tvl ?? "n/a") +
      `\n*Efficiency view:*\n` +
      `Higher utilization means more capital is being put to work, but also tighter exit liquidity\\. ` +
      `Lower borrow APY is generally better for borrowers\\. Higher supply APY can reflect either demand or inflated incentives — check the yield source\\.\n` +
      notFoundNote +
      `\n─────────────────\n` +
      `⚠️ _Not financial advice\\. Data from DefiLlama\\._`,
    { parse_mode: "MarkdownV2" }
  );
}
