// src/commands/governance.ts
import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";

const SNAPSHOT_API = "https://hub.snapshot.org/graphql";

const TRACKED_SPACES = [
  "aave.eth",
  "morpho.eth",
  "eulerfinance.eth",
  "pendle-finance.eth",
  "compound-governance.eth",
];

interface SnapshotProposal {
  id: string;
  title: string;
  end: number;
  space: {
    name: string;
    id: string;
  };
}

interface SnapshotResponse {
  data: {
    proposals: SnapshotProposal[];
  };
}

function formatEnd(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function snapshotUrl(spaceId: string, proposalId: string): string {
  return `https://snapshot.org/#/${spaceId}/proposal/${proposalId}`;
}

/**
 * Fetches active proposals and returns formatted string.
 * Exported for use by the digest job.
 */
export async function fetchActiveProposals(): Promise<string> {
  try {
    const query = `
      query {
        proposals(
          first: 20,
          where: { space_in: ${JSON.stringify(TRACKED_SPACES)}, state: "active" },
          orderBy: "end",
          orderDirection: asc
        ) {
          id
          title
          end
          space { id name }
        }
      }
    `;

    const res = await fetch(SNAPSHOT_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "MultyrBot/1.0",
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) return "Governance data temporarily unavailable.";

    const json = (await res.json()) as SnapshotResponse;
    const proposals = json?.data?.proposals ?? [];

    if (proposals.length === 0) {
      return "No active proposals right now across tracked protocols. Check back later.";
    }

    // Group by space name
    const grouped = new Map<string, SnapshotProposal[]>();
    for (const p of proposals) {
      const key = p.space.name;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(p);
    }

    const lines: string[] = ["Active governance proposals\n"];

    for (const [spaceName, props] of grouped.entries()) {
      lines.push(spaceName);
      for (const p of props) {
        const spaceId = p.space.id;
        const url = snapshotUrl(spaceId, p.id);
        lines.push(`- ${p.title} — ends ${formatEnd(p.end)}`);
        lines.push(`  ${url}`);
      }
      lines.push("");
    }

    lines.push("Always review full proposal before voting.");
    return lines.join("\n");
  } catch {
    return "Governance data temporarily unavailable.";
  }
}

export async function handleGovernance(ctx: CommandContext<Context>): Promise<void> {
  const from = ctx.from;

  if (from) {
    await logCommand({
      userId: from.id,
      username: from.username,
      firstName: from.first_name,
      chatId: ctx.chat.id,
      command: "/governance",
      args: "",
    });
  }

  const loadingMsg = await ctx.reply("Checking active proposals on Aave, Morpho, Pendle, Euler, Compound...");

  const text = await fetchActiveProposals();

  try {
    await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
  } catch {
    // ignore
  }

  await ctx.reply(text);
}
