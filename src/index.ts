import "dotenv/config";
import { Bot, webhookCallback } from "grammy";
import { IncomingMessage, ServerResponse } from "http";

import { handleStart } from "./commands/start";
import { handleRedflags } from "./commands/redflags";
import { handleCheck } from "./commands/check";
import { handleCompare } from "./commands/compare";
import { handlePoll } from "./commands/poll";
import { handleWatchlist } from "./commands/watchlist";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

const bot = new Bot(token);

bot.command("start", handleStart);
bot.command("help", handleStart);
bot.command("redflags", handleRedflags);
bot.command("check", handleCheck);
bot.command("compare", handleCompare);
bot.command("poll", handlePoll);
bot.command("watchlist", handleWatchlist);

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text ?? "";
  if (text.startsWith("/")) {
    await ctx.reply("Unknown command. Use /start to see what's available.");
  }
});

const handleWebhook = webhookCallback(bot, "http");

module.exports = async (req: IncomingMessage, res: ServerResponse) => {
  const url = (req as { url?: string }).url ?? "";

  if (url.startsWith("/api/health")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ts: Date.now() }));
    return;
  }

  if (url.startsWith("/api/webhook")) {
    await handleWebhook(req, res);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
};

export { bot };
