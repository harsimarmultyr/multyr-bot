// src/commands/aave.ts
import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";
import { fetchAaveAllReserves, formatUSD } from "../lib/defi";

const RAY = 1e27;

function rayToPercent(ray: string): string {
  const val = (parseFloat(ray) / RAY) * 100;
  return isNaN(val) ? "n/a" : `${val.toFixed(2)}%`;
}

function utilizationToPercent(raw: string): string {
  const val = parseFloat(raw) * 100;
  return isNaN(val) ? "n/a" : `${val.toFixed(1)}%`;
}

function bpsToPercent(raw: string): string {
  // Aave stores LTV and liquidation threshold as basis points (e.g. 8000 = 80%)
  const val = parseFloat(raw) / 100;
  return isNaN(val) ? "n/a" : `${val.toFixed(0)}%`;
}

export async function handleAave(ctx: CommandContext<Context>): Promise<void> {
  const from = ctx.from;
  const rawArgs = (ctx.match ?? "").trim();

  if (from) {
    await logCommand({
      userId: from.id,
      username: from.username,
      firstName: from.first_name,
      chatId: ctx.chat.id,
      command: "/aave",
      args: rawArgs,
    });
  }

  const loadingMsg = await ctx.reply(
    rawArgs
      ? `Fetching Aave V3 Arbitrum data for ${rawArgs.toUpperCase()}...`
      : "Fetching all Aave V3 Arbitrum markets..."
  );

  const reserves = await fetchAaveAllReserves();

  try {
    await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
  } catch {
    // ignore delete errors
  }

  if (reserves.length === 0) {
    await ctx.reply(
      "Aave V3 Arbitrum data is temporarily unavailable. Please try again shortly.\n\nNot financial advice."
    );
    return;
  }

  // No args — list all available symbols
  if (!rawArgs) {
    const symbols = reserves.map((r) => r.symbol).join(", ");
    await ctx.reply(
      "Aave V3 Arbitrum — available assets\n\n" +
        symbols +
        "\n\nUse /aave [symbol] to see full details, e.g. /aave USDC\n\nNot financial advice."
    );
    return;
  }

  // Find the matching reserve
  const assetUpper = rawArgs.toUpperCase();
  const assetLower = rawArgs.toLowerCase();
  const reserve = reserves.find(
    (r) =>
      r.symbol.toUpperCase() === assetUpper ||
      r.symbol.toLowerCase().includes(assetLower)
  );

  if (!reserve) {
    const symbols = reserves.map((r) => r.symbol).join(", ");
    await ctx.reply(
      `No data found for "${rawArgs}" on Aave V3 Arbitrum.\n\nAvailable assets: ${symbols}\n\nNot financial advice.`
    );
    return;
  }

  const supplyApy = rayToPercent(reserve.liquidityRate);
  const varBorrowApy = rayToPercent(reserve.variableBorrowRate);
  const stableBorrowApy = rayToPercent(reserve.stableBorrowRate);
  const util = utilizationToPercent(reserve.utilizationRate);
  const ltv = bpsToPercent(reserve.baseLTVasCollateral);
  const liqThreshold = bpsToPercent(reserve.reserveLiquidationThreshold);

  // Total supplied / borrowed — stored as token amounts, we show raw formatted
  const totalSupplied =
    reserve.totalLiquidity && reserve.totalLiquidity !== "0"
      ? formatUSD(parseFloat(reserve.totalLiquidity))
      : "n/a";
  const totalBorrowed =
    reserve.totalDebt && reserve.totalDebt !== "0"
      ? formatUSD(parseFloat(reserve.totalDebt))
      : "n/a";

  const frozenWarning = reserve.isFrozen
    ? "\nWARNING: This asset is currently FROZEN on Aave. No new deposits or borrows allowed.\n"
    : "";

  const stableNote =
    stableBorrowApy !== "n/a"
      ? `Stable borrow APY: ${stableBorrowApy}\n`
      : "";

  await ctx.reply(
    `${reserve.symbol} — Aave V3 Arbitrum\n` +
      "\n" +
      `Supply APY:         ${supplyApy}\n` +
      `Variable borrow:    ${varBorrowApy}\n` +
      stableNote +
      `Utilization:        ${util}\n` +
      `Total supplied:     ${totalSupplied}\n` +
      `Total borrowed:     ${totalBorrowed}\n` +
      `LTV (max):          ${ltv}\n` +
      `Liq. threshold:     ${liqThreshold}\n` +
      frozenWarning +
      "\n" +
      "Source: Aave V3 Arbitrum API\n\n" +
      "Not financial advice."
  );
}
