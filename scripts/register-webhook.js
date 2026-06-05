#!/usr/bin/env node
/**
 * register-webhook.js
 * Run this once after deploying to Vercel to register the webhook URL with Telegram.
 * Usage: node scripts/register-webhook.js
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = process.env.WEBHOOK_URL;

if (!token || !webhookUrl) {
  console.error("Set TELEGRAM_BOT_TOKEN and WEBHOOK_URL before running this script.");
  process.exit(1);
}

const url = `https://api.telegram.org/bot${token}/setWebhook`;
const payload = {
  url: `${webhookUrl}/api/webhook`,
  allowed_updates: ["message", "callback_query", "poll_answer"],
  drop_pending_updates: true,
};

fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
})
  .then((r) => r.json())
  .then((data) => {
    if (data.ok) {
      console.log("✅ Webhook registered successfully.");
      console.log(`   URL: ${payload.url}`);
    } else {
      console.error("❌ Failed:", data);
    }
  })
  .catch((err) => {
    console.error("❌ Request failed:", err);
    process.exit(1);
  });
