/**
 * 市场大盘页：走后端 `/api/market/*`（CCXT / Binance USDM），不经浏览器直连交易所。
 */
import { fetchJson } from "@/lib/api";

export type MarketTickerRow = {
  symbol: string;
  timestamp: number | null;
  datetime: string | null;
  high: number | null;
  low: number | null;
  bid: number | null;
  ask: number | null;
  open: number | null;
  close: number | null;
  last: number | null;
  previousClose: number | null;
  change: number | null;
  percentage: number | null;
  average: number | null;
  baseVolume: number | null;
  quoteVolume: number | null;
  vwap: number | null;
};

export type FuturesTickerTableResponse = {
  exchange: string;
  market: string;
  rows: MarketTickerRow[];
  fetchedAt: number;
};

export type TopGainerItem = {
  symbol: string;
  last: number;
  pct24h: number;
  quoteVolume: number | null;
  periods: Record<string, number | null>;
};

export type TopGainersResponse = {
  exchange: string;
  market: string;
  limit: number;
  timeframes: string[];
  items: TopGainerItem[];
  fetchedAt: number;
};

export async function fetchFuturesTickerTable() {
  return await fetchJson<FuturesTickerTableResponse>("/api/market/futures-tickers");
}

export async function fetchTopGainers() {
  return await fetchJson<TopGainersResponse>("/api/market/top-gainers");
}
