// src/jobs/digest.ts
import { bot } from "../index";
import { fetchTopRates } from "../commands/rates";
import { fetchActiveProposals } from "../commands/governance";

/**
 * Runs the daily digest and sends it to DIGEST_CHAT_ID.
 * Called by api/digest.ts (Vercel cron).
 */
export async function runDigest(): Promise<void> {
  const chatId = process.env.DIGEST_CHAT_ID;
  if (!chatId) {
    console.error("[digest] DIGEST_CHAT_ID is not set — skipping send.");
    return;
  }

  let ratesText: string;
  let govText: string;

  try {
    ratesText = await fetchTopRates("Arbitrum", 5);
  } catch {
    ratesText = "Rate data temporarily unavailable.";
  }

  try {
    govText = await fetchActiveProposals();
  } catch {
    govText = "Governance data temporarily unavailable.";
  }

  // Build governance summary — condense to just titles + end dates for the digest
  const govLines = govText
    .split("\n")
    .filter(
      (line) =>
        line.startsWith("- ") ||
        line.startsWith("Aave") ||
        line.startsWith("Morpho") ||
        line.startsWith("Euler") ||
        line.startsWith("Pendle") ||
        line.startsWith("Compound") ||
        line === "No active proposals right now across tracked protocols. Check back later."
    )
    .slice(0, 6) // cap at 6 lines to keep digest concise
    .join("\n");

  const message =
    "Multyr Daily Digest\n\n" +
    "Top Arbitrum rates right now:\n" +
    ratesText +
    "\n\n" +
    "Governance:\n" +
    (govLines || "No active proposals right now.") +
    "\n\n" +
    "Not financial advice. Data from DefiLlama + Snapshot.";

  await bot.api.sendMessage(chatId, message);
}
