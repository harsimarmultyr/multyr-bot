// src/lib/defi.ts
/**
 * defi.ts
 * Lightweight data layer. Pulls from DefiLlama and Aave V3 REST API.
 * Falls back gracefully when data is unavailable.
 * Aave REST is used as fallback for borrowApy / utilization when DefiLlama returns n/a.
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
const AAVE_ARBITRUM_API =
  "https://aave-api-v2.aave.com/data/markets-data?marketName=proto_arbitrum_v3";

// Ray = 1e27 — Aave stores rates in ray units
const RAY = 1e27;

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

interface AaveReserve {
  symbol: string;
  liquidityRate: string;        // ray
  variableBorrowRate: string;   // ray
  stableBorrowRate: string;     // ray
  utilizationRate: string;      // already 0–1 (not ray)
  totalLiquidity: string;
  totalDebt: string;
  isFrozen: boolean;
  reserveLiquidationThreshold: string;
  baseLTVasCollateral: string;
}

interface AaveApiResponse {
  reserves: AaveReserve[];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function formatUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

async function fetchAaveReserve(asset: string): Promise<AaveReserve | null> {
  try {
    const res = await fetch(AAVE_ARBITRUM_API, {
      headers: { "User-Agent": "MultyrBot/1.0" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as AaveApiResponse;
    const reserves = json.reserves ?? [];
    const assetN = normalize(asset);
    return (
      reserves.find((r) => normalize(r.symbol).includes(assetN)) ?? null
    );
  } catch {
    return null;
  }
}

export async function fetchAaveAllReserves(): Promise<AaveReserve[]> {
  try {
    const res = await fetch(AAVE_ARBITRUM_API, {
      headers: { "User-Agent": "MultyrBot/1.0" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as AaveApiResponse;
    return json.reserves ?? [];
  } catch {
    return [];
  }
}

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

    const scored = pools
      .map((p) => {
        let score = 0;
        if (normalize(p.symbol).includes(assetN)) score += 3;
        if (normalize(p.project).includes(protocolN)) score += 2;
        if (normalize(p.chain).includes(chainN)) score += 1;
        return { pool: p, score };
      })
      .filter((x) => x.score >= 3)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return null;
    const best = scored[0].pool;

    let supplyApy =
      best.apyBase != null
        ? `${best.apyBase.toFixed(2)}%`
        : best.apy != null
        ? `${best.apy.toFixed(2)}%`
        : "n/a";

    let borrowApy =
      best.apyBaseBorrow != null ? `${best.apyBaseBorrow.toFixed(2)}%` : "n/a";

    let util =
      best.utilization != null ? `${best.utilization.toFixed(1)}%` : "n/a";

    const tvl = best.tvlUsd != null ? formatUSD(best.tvlUsd) : "n/a";

    // Fallback to Aave REST when fields are missing — only for Aave on Arbitrum
    const needsFallback =
      (borrowApy === "n/a" || util === "n/a") &&
      normalize(protocol).includes("aave") &&
      normalize(chain).includes("arb");

    if (needsFallback) {
      const aaveReserve = await fetchAaveReserve(asset);
      if (aaveReserve) {
        if (borrowApy === "n/a" && aaveReserve.variableBorrowRate) {
          const borrow = (parseFloat(aaveReserve.variableBorrowRate) / RAY) * 100;
          if (!isNaN(borrow)) borrowApy = `${borrow.toFixed(2)}%`;
        }
        if (util === "n/a" && aaveReserve.utilizationRate) {
          const utilVal = parseFloat(aaveReserve.utilizationRate) * 100;
          if (!isNaN(utilVal)) util = `${utilVal.toFixed(1)}%`;
        }
        if (supplyApy === "n/a" && aaveReserve.liquidityRate) {
          const supply = (parseFloat(aaveReserve.liquidityRate) / RAY) * 100;
          if (!isNaN(supply)) supplyApy = `${supply.toFixed(2)}%`;
        }
      }
    }

    return {
      protocol: best.project,
      asset: best.symbol,
      chain: best.chain,
      supplyApy,
      borrowApy,
      utilization: util,
      tvl,
      source: needsFallback ? "DefiLlama + Aave API" : "DefiLlama",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

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
