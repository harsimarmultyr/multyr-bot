import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";
import { isAdmin } from "../lib/admin";

const DISCUSSION_PROMPTS = [
  {
    question: "Which risk is most underestimated in DeFi lending right now?",
    options: ["Oracle manipulation", "Admin key risk", "Liquidity crunch", "Recursive leverage", "Stablecoin depeg"],
  },
  {
    question: "What is your biggest concern with automated capital allocation?",
    options: ["Rebalancing risk", "Smart contract bugs", "Yield dilution", "Governance attacks", "Regulatory pressure"],
  },
  {
    question: "How do you think about utilization rates when deploying capital?",
    options: ["Under 70% only", "Under 85% is fine", "Doesn't matter much", "I watch it actively", "Depends on protocol"],
  },
  {
    question: "Which DeFi primitive is most mature on Arbitrum right now?",
    options: ["Lending markets", "DEX liquidity", "Yield vaults", "Perps and derivatives", "None yet"],
  },
  {
    question: "What would make you trust a new yield vault with meaningful capital?",
    options: ["Audit history", "TVL and track record", "Open-source code", "Team reputation", "Always small test first"],
  },
];

export async function handlePoll(ctx: CommandContext<Context>): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  if (!isAdmin(from.id)) {
    await ctx.reply("This command is for admins only.");
    return;
  }

  await logCommand({
    userId: from.id,
    username: from.username,
    firstName: from.first_name,
    chatId: ctx.chat.id,
    command: "/poll",
  });

  const rawArgs = ctx.match?.trim() ?? "";
  let prompt = DISCUSSION_PROMPTS[Math.floor(Math.random() * DISCUSSION_PROMPTS.length)];

  if (rawArgs.includes("|")) {
    const parts = rawArgs.split("|").map((p) => p.trim());
    if (parts.length >= 3) {
      prompt = {
        question: parts[0],
        options: parts.slice(1).slice(0, 10),
      };
    }
  }

  await ctx.api.sendPoll(ctx.chat.id, prompt.question, prompt.options, {
    is_anonymous: false,
    allows_multiple_answers: false,
  });
}
