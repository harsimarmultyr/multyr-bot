// api/digest.ts
import { IncomingMessage, ServerResponse } from "http";
import { runDigest } from "../src/jobs/digest";

module.exports = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const secret = process.env.DIGEST_SECRET;

  // Validate the secret header
  const incoming = (req.headers as Record<string, string | string[] | undefined>)[
    "x-digest-secret"
  ];
  const incomingStr = Array.isArray(incoming) ? incoming[0] : incoming;

  if (!secret || incomingStr !== secret) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
    return;
  }

  try {
    await runDigest();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ts: Date.now() }));
  } catch (err) {
    console.error("[digest] Error running digest:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Internal error" }));
  }
};
