/**
 * 监控页专用：拼 URL、拉取代理数据、导出上游返回的「原始类型」形状。
 * ----------------------------------------------------------------
 * - Binance 的 REST 很多是公开 HTTPS，但浏览器直接调会遇到 CORS，所以统一走
 *   后端 `/api/proxy?u=...`（白名单域名在 apps/api/.env 里配置）。
 * - 下面的 TypeScript 类型只是帮助编辑器提示字段名，**运行时不会校验**；
 *   上游若改字段，页面要做兜底（见 monitor/page.tsx）。
 */
import { fetchJson } from "@/lib/api";

/** 把完整 HTTPS 地址交给后端白名单代理（返回 JSON）。 */
export function proxyUrl(u: string) {
  return `/api/proxy?u=${encodeURIComponent(u)}`;
}

export async function fetchProxyJson<T = unknown>(u: string) {
  return await fetchJson<T>(proxyUrl(u));
}

export type BinanceFuturesExchangeInfo = {
  symbols?: Array<{
    symbol: string;
    status: string;
    contractType: string;
    quoteAsset: string;
  }>;
};

export type BinanceFuturesTicker24hRaw = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
  count?: number | string;
};

export type BinanceFuturesPremiumIndexRaw = {
  symbol: string;
  lastFundingRate: string;
  markPrice: string;
};

export type BinanceForceOrderRaw = {
  side: "BUY" | "SELL";
  price: string;
  origQty: string;
  time: number;
};

export type BinanceOpenInterestHistRaw = {
  sumOpenInterest: string;
};

export type BinanceLongShortRatioRaw = {
  longShortRatio: string;
  longAccount: string;
  shortAccount: string;
};
