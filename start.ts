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
    });
  }

  await ctx.reply(
    `👁 *Multyr DeFi Risk Lens*\n\n` +
      `A lightweight tool to help you pressure-test DeFi strategies, lending markets, and yield sources before you commit capital.\n\n` +
      `*Available commands:*\n\n` +
      `/redflags — Universal DeFi red flag checklist\n` +
      `/check [market] — Risk breakdown for a specific market\n` +
      `  _e.g. /check Aave USDC Arbitrum_\n\n` +
      `/compare [assetA] [assetB] [protocol] [chain] — Side-by-side market comparison\n` +
      `  _e.g. /compare USDC DAI Aave Arbitrum_\n\n` +
      `/watchlist — View saved markets \\(admins can add/remove\\)\n` +
      `/poll — Create a DeFi discussion poll \\(admins only\\)\n\n` +
      `─────────────────\n` +
      `⚠️ _Nothing here is financial advice\\. Always do your own research\\._`,
    { parse_mode: "MarkdownV2" }
  );
}
