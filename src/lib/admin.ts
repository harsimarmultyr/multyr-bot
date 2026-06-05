/**
 * Returns the list of admin Telegram user IDs from env.
 * ADMIN_TELEGRAM_IDS is a comma-separated string of numeric IDs.
 */
export function getAdminIds(): number[] {
  const raw = process.env.ADMIN_TELEGRAM_IDS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n));
}

export function isAdmin(userId: number): boolean {
  return getAdminIds().includes(userId);
}
