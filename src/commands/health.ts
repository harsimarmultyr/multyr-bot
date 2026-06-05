// src/commands/health.ts
import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";

function statusLabel(hf: number): string {
  if (hf > 2.0) return "SAFE";
  if (hf >= 1.5) return "CAUTION";
  if (hf >= 1.1) return "WARNING";
  return "DANGER";
}

export async function handleHealth(ctx: CommandContext<Context>): Promise<void> {
  const from = ctx.from;
  const rawArgs = (ctx.match ?? "").trim();

  if (from) {
    await logCommand({
      userId: from.id,
      username: from.username,
      firstName: from.first_name,
      chatId: ctx.chat.id,
      command: "/health",
      args: rawArgs,
    });
  }

  if (!rawArgs) {
    await ctx.reply(
      "Health factor calculator\n\n" +
        "Formula: Health Factor = (collateral * liquidation_threshold) / debt\n\n" +
        "Usage: /health [debt] [collateral] [liquidation_threshold]\n\n" +
        "The threshold can be a decimal (0.85) or percentage (85) — both work.\n\n" +
        "Example: /health 1000 1500 0.85\n" +
        "  Debt: $1,000 | Collateral: $1,500 | Threshold: 85%\n\n" +
        "Typical thresholds: USDC 87%, ETH 82.5%, WBTC 75% — check your protocol.\n\n" +
        "Not financial advice — use your protocol's actual parameters."
    );
    return;
  }

  const tokens = rawArgs.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) {
    await ctx.reply(
      "Need 3 values: /health [debt] [collateral] [liquidation_threshold]\n\nExample: /health 1000 1500 0.85\n\nNot financial advice — use your protocol's actual parameters."
    );
    return;
  }

  const debt = parseFloat(tokens[0]);
  const collateral = parseFloat(tokens[1]);
  let threshold = parseFloat(tokens[2]);

  if (isNaN(debt) || isNaN(collateral) || isNaN(threshold)) {
    await ctx.reply(
      "Could not parse numbers. Make sure all three values are numeric.\n\nExample: /health 1000 1500 0.85\n\nNot financial advice — use your protocol's actual parameters."
    );
    return;
  }

  // Accept both 85 and 0.85 as threshold
  if (threshold > 1) {
    threshold = threshold / 100;
  }

  if (debt <= 0) {
    await ctx.reply(
      "Debt must be greater than zero.\n\nNot financial advice — use your protocol's actual parameters."
    );
    return;
  }

  if (threshold <= 0 || threshold >= 1) {
    await ctx.reply(
      "Liquidation threshold must be between 0 and 1 (or 1 and 100 as a percentage).\n\nExample: 0.85 or 85\n\nNot financial advice — use your protocol's actual parameters."
    );
    return;
  }

  const hf = (collateral * threshold) / debt;
  const label = statusLabel(hf);

  // How much collateral can drop before HF = 1.0 (liquidation)
  // HF = 1.0 when: collateral_drop * threshold = debt
  // liquidation_collateral = debt / threshold
  // drop% = (collateral - liquidation_collateral) / collateral * 100
  const liquidationCollateral = debt / threshold;
  const dropBeforeLiquidation =
    collateral > liquidationCollateral
      ? ((collateral - liquidationCollateral) / collateral) * 100
      : 0;

  // Max additional borrow before reaching HF = 1.1 (danger zone)
  // HF = 1.1 when: (collateral * threshold) / (debt + maxExtraBorrow) = 1.1
  // maxExtraBorrow = (collateral * threshold) / 1.1 - debt
  const maxExtraBorrow = Math.max(0, (collateral * threshold) / 1.1 - debt);

  await ctx.reply(
    "Liquidation health check\n\n" +
      `Debt:          $${debt.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}\n` +
      `Collateral:    $${collateral.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}\n` +
      `Threshold:     ${(threshold * 100).toFixed(0)}%\n\n` +
      `Health Factor: ${hf.toFixed(2)}\n` +
      `Status:        ${label}\n\n` +
      (label === "SAFE"
        ? "Your position is well-protected right now.\n"
        : label === "CAUTION"
        ? "You have some buffer but watch for market volatility.\n"
        : label === "WARNING"
        ? "Getting close to the danger zone. Consider reducing exposure.\n"
        : "CRITICAL: You are very close to liquidation. Act immediately.\n") +
      "\n" +
      `Collateral buffer: You can absorb a ${dropBeforeLiquidation.toFixed(1)}% drop in collateral value before liquidation.\n\n` +
      `Max safe borrow: You can add approximately $${maxExtraBorrow.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} more debt before entering the danger zone (HF 1.1).\n\n` +
      "Not financial advice — use your protocol's actual parameters."
  );
}
