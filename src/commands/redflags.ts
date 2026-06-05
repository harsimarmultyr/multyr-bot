import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";

export async function handleRedflags(ctx: CommandContext<Context>): Promise<void> {
  const from = ctx.from;
  if (from) {
    await logCommand({
      userId: from.id,
      username: from.username,
      firstName: from.first_name,
      chatId: ctx.chat.id,
      command: "/redflags",
    });
  }

  await ctx.reply(
    `🚩 DeFi Red Flag Checklist\n\n` +
      `Run through these before putting capital into any strategy or vault.\n\n` +
      `1. Exit liquidity\n` +
      `Can you actually get out? Check pool depth, withdrawal queues, and whether liquidity is genuine or mercenary.\n\n` +
      `2. Collateral verifiability\n` +
      `Is the backing easy to verify on-chain? Opaque or off-chain collateral is a risk most users underestimate.\n\n` +
      `3. Leverage and looping\n` +
      `Is there recursive borrowing or looping involved? The higher the loop count, the smaller the move needed to trigger a cascade.\n\n` +
      `4. Oracle and pricing assumptions\n` +
      `Which oracle feeds prices? Are they manipulation-resistant? TWAP vs spot - what happens if price spikes or drops sharply?\n\n` +
      `5. Admin and governance permissions\n` +
      `Who can upgrade the contract, pause withdrawals, or change fee parameters? Are there timelocks? Is there a multisig?\n\n` +
      `6. Yield source clarity\n` +
      `Where does the yield actually come from? Real lending fees, token emissions, or unsustainable subsidies? If you can't answer this, that's a flag.\n\n` +
      `─────────────────\n` +
      `Use /check [market] to run this lens on a specific market.\n\n` +
      `Not financial advice.`
  );
}
