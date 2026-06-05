// src/commands/start.ts
import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";

export async function handleStart(ctx: CommandContext<Context>): Promise<void> {
  const from = ctx.from;

  if (from) {
    await logCommand({
      userId: from.id,
      username: from.username,
      firstName: from.first_name,
      chatId: ctx.chat.id,
      command: "/start",
      args: "",
    });
  }

  await ctx.reply(
    "Multyr — DeFi research bot\n\n" +
      "Market data\n" +
      "/check [protocol] [asset] [chain] — Fetch yield + risk flags for any market\n" +
      "/compare [assetA] [assetB] [protocol] [chain] — Side-by-side comparison\n" +
      "/aave [asset] — Live Aave V3 Arbitrum data (supply, borrow, LTV, utilization)\n" +
      "/rates — Top yield rates on Arbitrum right now\n" +
      "/yield [asset] — Best rate for an asset across all chains\n\n" +
      "Risk tools\n" +
      "/health [debt] [collateral] [threshold] — Calculate liquidation risk\n" +
      "/redflags — Full DeFi due-diligence checklist\n" +
      "/watchlist — Manage your saved positions\n\n" +
      "Protocol intelligence\n" +
      "/governance — Active proposals on Aave, Morpho, Pendle, Euler, Compound\n" +
      "/unlock — Upcoming token unlocks in the next 14 days\n\n" +
      "Community\n" +
      "/poll — Create a quick community poll\n\n" +
      "Examples:\n" +
      "/check Aave USDC Arbitrum\n" +
      "/aave WETH\n" +
      "/yield USDC\n" +
      "/health 1000 1500 0.85\n" +
      "/compare USDC USDT Aave Arbitrum\n\n" +
      "Data from DefiLlama, Aave API, and Snapshot. Not financial advice."
  );
}
