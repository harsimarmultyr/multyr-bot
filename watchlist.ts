import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";
import { isAdmin } from "../lib/admin";
import { supabase } from "../lib/supabase";

function escapeMarkdown(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

export async function handleWatchlist(ctx: CommandContext<Context>): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const rawArgs = ctx.match?.trim() ?? "";

  await logCommand({
    userId: from.id,
    username: from.username,
    firstName: from.first_name,
    chatId: ctx.chat.id,
    command: "/watchlist",
    args: rawArgs,
  });

  // Sub-commands: add, remove — admin only
  if (rawArgs.startsWith("add ") || rawArgs.startsWith("remove ")) {
    if (!isAdmin(from.id)) {
      await ctx.reply("⛔ Only admins can modify the watchlist.");
      return;
    }

    if (rawArgs.startsWith("add ")) {
      const entry = rawArgs.slice(4).trim();
      const parts = entry.split(/\s+/);
      const { error } = await supabase.from("watchlist").insert({
        protocol: parts[0] ?? "unknown",
        asset: parts[1] ?? "",
        chain: parts[2] ?? "arbitrum",
        added_by: from.id,
        note: parts.slice(3).join(" ") || null,
      });

      if (error) {
        await ctx.reply(`❌ Failed to add to watchlist: ${escapeMarkdown(error.message)}`, {
          parse_mode: "MarkdownV2",
        });
      } else {
        await ctx.reply(`✅ Added *${escapeMarkdown(entry)}* to the watchlist\\.`, {
          parse_mode: "MarkdownV2",
        });
      }
      return;
    }

    if (rawArgs.startsWith("remove ")) {
      const idStr = rawArgs.slice(7).trim();
      const id = parseInt(idStr, 10);
      if (isNaN(id)) {
        await ctx.reply("Usage: /watchlist remove \\[id\\]", { parse_mode: "MarkdownV2" });
        return;
      }
      const { error } = await supabase.from("watchlist").delete().eq("id", id);
      if (error) {
        await ctx.reply(`❌ Failed to remove: ${escapeMarkdown(error.message)}`, {
          parse_mode: "MarkdownV2",
        });
      } else {
        await ctx.reply(`🗑 Removed watchlist entry #${id}\\.`, { parse_mode: "MarkdownV2" });
      }
      return;
    }
  }

  // Default: show watchlist
  const { data, error } = await supabase
    .from("watchlist")
    .select("id, protocol, asset, chain, note, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    await ctx.reply("❌ Could not load watchlist right now\\.", { parse_mode: "MarkdownV2" });
    return;
  }

  if (!data || data.length === 0) {
    await ctx.reply(
      `📋 *Watchlist is empty*\n\nAdmins can add markets with:\n/watchlist add \\[protocol\\] \\[asset\\] \\[chain\\] \\[optional note\\]\n_Example: /watchlist add Aave USDC Arbitrum monitoring utilization_`,
      { parse_mode: "MarkdownV2" }
    );
    return;
  }

  const lines = data.map((row: { id: number; protocol: string; asset: string; chain: string; note?: string }) =>
    `• \\[${row.id}\\] *${escapeMarkdown(row.protocol)}* — ${escapeMarkdown(row.asset)} on ${escapeMarkdown(row.chain)}` +
    (row.note ? `\n   _${escapeMarkdown(row.note)}_` : "")
  );

  const adminHint = isAdmin(from.id)
    ? `\n\n_Admins: /watchlist add \\[protocol\\] \\[asset\\] \\[chain\\] or /watchlist remove \\[id\\]_`
    : "";

  await ctx.reply(
    `📋 *Watchlist* \\(${data.length} entries\\)\n\n` + lines.join("\n") + adminHint,
    { parse_mode: "MarkdownV2" }
  );
}
