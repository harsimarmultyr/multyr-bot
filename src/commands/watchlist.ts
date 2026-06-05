import { CommandContext, Context } from "grammy";
import { logCommand } from "../lib/logger";
import { isAdmin } from "../lib/admin";
import { supabase } from "../lib/supabase";

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

  if (rawArgs.startsWith("add ") || rawArgs.startsWith("remove ")) {
    if (!isAdmin(from.id)) {
      await ctx.reply("Only admins can modify the watchlist.");
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
        await ctx.reply(`Failed to add: ${error.message}`);
      } else {
        await ctx.reply(`Added ${entry} to the watchlist.`);
      }
      return;
    }

    if (rawArgs.startsWith("remove ")) {
      const id = parseInt(rawArgs.slice(7).trim(), 10);
      if (isNaN(id)) {
        await ctx.reply("Usage: /watchlist remove [id]");
        return;
      }
      const { error } = await supabase.from("watchlist").delete().eq("id", id);
      if (error) {
        await ctx.reply(`Failed to remove: ${error.message}`);
      } else {
        await ctx.reply(`Removed watchlist entry #${id}.`);
      }
      return;
    }
  }

  const { data, error } = await supabase
    .from("watchlist")
    .select("id, protocol, asset, chain, note, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    await ctx.reply("Could not load watchlist right now.");
    return;
  }

  if (!data || data.length === 0) {
    await ctx.reply(
      `Watchlist is empty.\n\nAdmins can add markets with:\n/watchlist add [protocol] [asset] [chain] [optional note]\nExample: /watchlist add Aave USDC Arbitrum monitoring utilization`
    );
    return;
  }

  const lines = data.map((row: { id: number; protocol: string; asset: string; chain: string; note?: string }) =>
    `[${row.id}] ${row.protocol} - ${row.asset} on ${row.chain}` + (row.note ? `\n   ${row.note}` : "")
  );

  const adminHint = isAdmin(from.id)
    ? `\n\nAdmins: /watchlist add [protocol] [asset] [chain] or /watchlist remove [id]`
    : "";

  await ctx.reply(`Watchlist (${data.length} entries)\n\n` + lines.join("\n") + adminHint);
}
