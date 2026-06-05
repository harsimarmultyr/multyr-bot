/**
 * defi.ts
 * Lightweight data layer. Pulls from DefiLlama and Aave subgraph.
 * Falls back gracefully when data is unavailable.
 */

export interface MarketData {
  protocol: string;
  asset: string;
  chain: string;
  supplyApy: string;
  borrowApy: string;
  utilization: string;
  tvl: string;
  source: string;
  fetchedAt: string;
}

const DEFILLAMA_POOLS = "https://yields.llama.fi/pools";

interface LlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  apyBorrow: number | null;
  apyBaseBorrow: number | null;
  utilization: number | null;
}

/**
 * Normalise a search term for fuzzy matching against pool symbols.
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Fetch and filter DefiLlama yield pools matching the given query.
 */
export async function fetchMarketData(
  asset: string,
  protocol: string,
  chain: string
): Promise<MarketData | null> {
  try {
    const res = await fetch(DEFILLAMA_POOLS, {
      headers: { "User-Agent": "MultyrBot/1.0" },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as { data: LlamaPool[] };
    const pools = json.data ?? [];

    const assetN = normalize(asset);
    const protocolN = normalize(protocol);
    const chainN = normalize(chain);

    // Score each pool and take best match
    const scored = pools
      .map((p) => {
        let score = 0;
        if (normalize(p.symbol).includes(assetN)) score += 3;
        if (normalize(p.project).includes(protocolN)) score += 2;
        if (normalize(p.chain).includes(chainN)) score += 1;
        return { pool: p, score };
      })
      .filter((x) => x.score >= 3) // must match asset at minimum
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return null;

    const best = scored[0].pool;
    const util = best.utilization != null ? `${best.utilization.toFixed(1)}%` : "n/a";
    const supplyApy = best.apyBase != null ? `${best.apyBase.toFixed(2)}%` : best.apy != null ? `${best.apy.toFixed(2)}%` : "n/a";
    const borrowApy = best.apyBaseBorrow != null ? `${best.apyBaseBorrow.toFixed(2)}%` : "n/a";
    const tvl = best.tvlUsd != null ? formatUSD(best.tvlUsd) : "n/a";

    return {
      protocol: best.project,
      asset: best.symbol,
      chain: best.chain,
      supplyApy,
      borrowApy,
      utilization: util,
      tvl,
      source: "DefiLlama",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch two markets for comparison. Returns [marketA, marketB].
 * Either may be null if not found.
 */
export async function fetchComparison(
  assetA: string,
  assetB: string,
  protocol: string,
  chain: string
): Promise<[MarketData | null, MarketData | null]> {
  const [a, b] = await Promise.all([
    fetchMarketData(assetA, protocol, chain),
    fetchMarketData(assetB, protocol, chain),
  ]);
  return [a, b];
}

function formatUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
