import { supabase } from "./supabase";

export interface CommandMeta {
  userId: number;
  username?: string;
  firstName?: string;
  chatId: number;
  command: string;
  args?: string;
}

/**
 * Upsert user record and log the command invocation.
 * Fails silently so bot never crashes on DB issues.
 */
export async function logCommand(meta: CommandMeta): Promise<void> {
  try {
    // Upsert user
    await supabase.from("users").upsert(
      {
        telegram_id: meta.userId,
        username: meta.username ?? null,
        first_name: meta.firstName ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "telegram_id", ignoreDuplicates: false }
    );

    // Insert command log
    await supabase.from("commands").insert({
      user_telegram_id: meta.userId,
      chat_id: meta.chatId,
      command: meta.command,
      args: meta.args ?? null,
      executed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[logCommand] DB error:", err);
  }
}
