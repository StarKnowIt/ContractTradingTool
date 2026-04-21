export type MarketSortMode = "vol" | "pct" | "sym";

const STORAGE_KEY = "ctbox.market.sort.v1";

export const DEFAULT_MARKET_SORT: MarketSortMode = "vol";

function parseSort(raw: unknown): MarketSortMode {
  if (raw === "vol" || raw === "pct" || raw === "sym") return raw;
  return DEFAULT_MARKET_SORT;
}

export function loadMarketSort(): MarketSortMode {
  if (typeof window === "undefined") return DEFAULT_MARKET_SORT;
  try {
    const s = window.localStorage.getItem(STORAGE_KEY);
    if (!s) return DEFAULT_MARKET_SORT;
    return parseSort(JSON.parse(s));
  } catch {
    return DEFAULT_MARKET_SORT;
  }
}

export function saveMarketSort(mode: MarketSortMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mode));
  } catch {
    /* ignore */
  }
}
