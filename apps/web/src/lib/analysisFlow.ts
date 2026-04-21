/**
 * 分析页数据流：与 legacy `js/analysis.js` 主流程对齐的纯函数聚合（可单测）。
 */

import type { IndicatorSignal } from "./analysisSentimentTags";

export const INDICATOR_NAME_MAP: Record<string, string> = {
  macd: "MACD",
  ema: "EMA 均线",
  ema200: "EMA200",
  gmma: "顾比复合均线",
  sar: "抛物线 SAR",
  aroon: "Aroon 指标",
  ichimoku: "一目均衡表",
  adx: "ADX 趋势强度",
  ma510: "MA5/MA10",
  ma2060: "MA20/MA60",
  ma60120: "MA60/MA120",
  maArrange: "均线排列",
  ma120: "MA120",
  vegasTrend: "维加斯通道",
  vegasEma12: "EMA12",
  td: "TD 序列",
  rsi: "RSI",
  kdj: "KDJ",
  stochrsi: "Stoch RSI",
  williamsr: "Williams %R",
  cci: "CCI",
  mfi: "MFI",
  roc: "ROC",
  boll: "布林带",
  bw: "带宽",
  atr: "ATR",
  keltner: "肯特纳通道",
  obv: "OBV",
  volume: "成交量",
  cmf: "CMF",
  vwap: "VWAP",
  pa: "价格行为 PA",
  wyckoff: "威科夫理论",
  donchian: "唐奇安通道",
  donchianPA: "唐奇安通道",
  avwap: "锚定 VWAP",
  lmtPct: "斐波那契位置",
};

export const INDICATOR_GROUPS: { id: string; title: string }[] = [
  { id: "trend", title: "趋势" },
  { id: "momentum", title: "动量" },
  { id: "volume", title: "量能" },
  { id: "volatility", title: "波动" },
  { id: "supp", title: "支撑阻力" },
  { id: "masys", title: "均线体系" },
  { id: "structure", title: "结构" },
  { id: "vegas", title: "维加斯" },
];

export type CompositeScoreView = {
  longPct: number;
  shortPct: number;
  bulls: number;
  bears: number;
  neutral: number;
  verdict: string;
  verdictColor: string;
  badgeClass: "badge-green" | "badge-red" | "badge-amber";
  badgeText: string;
};

/** 与 `renderScore` 一致：按 bull/bear 占比给出综合多空分与建议词。 */
export function computeCompositeScore(indicators: Record<string, IndicatorSignal>): CompositeScoreView {
  const all = Object.values(indicators);
  const bulls = all.filter((v) => v.type === "bull").length;
  const bears = all.filter((v) => v.type === "bear").length;
  const neutral = all.filter((v) => v.type === "neutral").length;
  const total = bulls + bears;
  const longScore = total === 0 ? 50 : Math.round((bulls / total) * 100);
  const shortScore = 100 - longScore;

  let verdict = "";
  let verdictColor = "var(--text-muted)";
  let badgeClass: CompositeScoreView["badgeClass"] = "badge-amber";
  let badgeText = "";
  if (longScore >= 70) {
    verdict = "LONG";
    verdictColor = "var(--green)";
    badgeClass = "badge-green";
    badgeText = "强烈做多";
  } else if (longScore >= 55) {
    verdict = "LONG?";
    verdictColor = "var(--green)";
    badgeClass = "badge-green";
    badgeText = "偏多";
  } else if (shortScore >= 70) {
    verdict = "SHORT";
    verdictColor = "var(--red)";
    badgeClass = "badge-red";
    badgeText = "强烈做空";
  } else if (shortScore >= 55) {
    verdict = "SHORT?";
    verdictColor = "var(--red)";
    badgeClass = "badge-red";
    badgeText = "偏空";
  } else {
    verdict = "WAIT";
    verdictColor = "var(--amber)";
    badgeClass = "badge-amber";
    badgeText = "观望";
  }

  return {
    longPct: longScore,
    shortPct: shortScore,
    bulls,
    bears,
    neutral,
    verdict,
    verdictColor,
    badgeClass,
    badgeText,
  };
}

export type NewsSentimentLabel = {
  label: string;
  color: string;
  desc: string;
};

type FgApi = { data?: { value?: string }[] };
type FundingRow = { fundingRate?: string };
type LsRow = { longShortRatio?: string; longAccount?: string; shortAccount?: string };

/**
 * 与 legacy `calcNewsSentiment` 一致，修正恐惧贪婪路径为 `data[0].value`（与 `/api/fg` 响应一致）。
 */
export function computeNewsSentimentLabel(
  indicators: Record<string, IndicatorSignal> | null,
  fg: FgApi | null,
  funding: FundingRow[] | null,
  ls: LsRow | LsRow[] | null
): NewsSentimentLabel {
  let score = 0;
  const reasons: string[] = [];

  const fgVal = fg?.data?.[0]?.value;
  if (fgVal !== undefined && fgVal !== "") {
    const fgN = parseInt(String(fgVal), 10);
    if (!Number.isNaN(fgN)) {
      if (fgN >= 70) {
        score += 2;
        reasons.push(`贪婪指数${fgN}(极度贪婪)`);
      } else if (fgN >= 55) {
        score += 1;
        reasons.push(`贪婪指数${fgN}(偏乐观)`);
      } else if (fgN <= 25) {
        score -= 2;
        reasons.push(`恐惧指数${fgN}(极度恐惧)`);
      } else if (fgN <= 40) {
        score -= 1;
        reasons.push(`恐惧指数${fgN}(偏悲观)`);
      }
    }
  }

  const frRaw = Array.isArray(funding) && funding[0] ? parseFloat(String(funding[0].fundingRate ?? 0)) * 100 : NaN;
  if (Number.isFinite(frRaw)) {
    const FR_BULL_THRESHOLD_PCT = 0.05;
    const FR_BEAR_THRESHOLD_PCT = -0.02;
    if (frRaw >= FR_BULL_THRESHOLD_PCT) {
      score += 1;
      reasons.push(`资金费率+${frRaw.toFixed(3)}%(多头积极)`);
    } else if (frRaw <= FR_BEAR_THRESHOLD_PCT) {
      score -= 1;
      reasons.push(`资金费率${frRaw.toFixed(3)}%(空头主导)`);
    }
  }

  let lsRatio: number | null = null;
  if (ls && !Array.isArray(ls)) {
    const v = (ls as LsRow).longShortRatio;
    if (v !== undefined) lsRatio = parseFloat(String(v));
  } else if (Array.isArray(ls) && ls[0]) {
    const row = ls[0] as LsRow;
    const lp = parseFloat(String(row.longAccount ?? 0));
    const sp = parseFloat(String(row.shortAccount ?? 0));
    if (sp > 0) lsRatio = lp / sp;
    else if (row.longShortRatio !== undefined) lsRatio = parseFloat(String(row.longShortRatio));
  }
  if (lsRatio !== null && Number.isFinite(lsRatio)) {
    if (lsRatio > 1.3) {
      score += 1;
      reasons.push(`多空比${lsRatio.toFixed(2)}(多头占优)`);
    } else if (lsRatio < 0.8) {
      score -= 1;
      reasons.push(`多空比${lsRatio.toFixed(2)}(空头占优)`);
    }
  }

  if (indicators) {
    const vals = Object.values(indicators);
    const bullN = vals.filter((v) => v.type === "bull").length;
    const bearN = vals.filter((v) => v.type === "bear").length;
    const t = bullN + bearN || 1;
    const techScore = (bullN - bearN) / t;
    if (techScore > 0.3) {
      score += 2;
      reasons.push(`技术面偏多(${bullN}利多/${bearN}利空)`);
    } else if (techScore > 0.1) {
      score += 1;
      reasons.push("技术面略多");
    } else if (techScore < -0.3) {
      score -= 2;
      reasons.push(`技术面偏空(${bearN}利空/${bullN}利多)`);
    } else if (techScore < -0.1) {
      score -= 1;
      reasons.push("技术面略空");
    }
  }

  let label: string;
  let color: string;
  if (score >= 4) {
    label = "强烈利多";
    color = "var(--green)";
  } else if (score >= 2) {
    label = "偏多";
    color = "var(--green)";
  } else if (score >= 1) {
    label = "略偏多";
    color = "#8bc34a";
  } else if (score <= -4) {
    label = "强烈利空";
    color = "var(--red)";
  } else if (score <= -2) {
    label = "偏空";
    color = "var(--red)";
  } else if (score <= -1) {
    label = "略偏空";
    color = "#ff9800";
  } else {
    label = "中性";
    color = "var(--gold)";
  }

  let desc = reasons.slice(0, 3).join("，");
  if (!desc) desc = "数据不足，暂无判断";

  return { label, color, desc };
}

export type OrderBookRow = {
  side: "bid" | "ask";
  price: number;
  size: number;
  barPct: number;
  isWall: boolean;
};

export type OrderBookSummary = {
  ok: false;
} | {
  ok: true;
  asks: OrderBookRow[];
  bids: OrderBookRow[];
  spread: number;
  spreadPct: string;
  bidDepth2Usd: number;
  askDepth2Usd: number;
  depthRatio: number | null;
  depthRatioNote: string;
  depthRatioColor: string;
  badgeClass: "badge-green" | "badge-red" | "badge-amber";
  badgeText: string;
  maxBidSize: number;
  maxAskSize: number;
  wallCount: number;
  liquidityHtml: string;
};

function safeNum(n: unknown): number {
  const x = typeof n === "number" ? n : parseFloat(String(n));
  return Number.isFinite(x) ? x : NaN;
}

/** 与 `renderOrderBook` 数值逻辑一致，供 React 渲染。 */
export function summarizeOrderBook(
  depth: { bids?: unknown[][]; asks?: unknown[][] } | null,
  currentPrice: number
): OrderBookSummary {
  const hasValidBook =
    depth &&
    Array.isArray(depth.bids) &&
    Array.isArray(depth.asks) &&
    depth.bids.length > 0 &&
    depth.asks.length > 0 &&
    Array.isArray(depth.bids[0]) &&
    Array.isArray(depth.asks[0]) &&
    depth.bids[0].length >= 2 &&
    depth.asks[0].length >= 2;

  if (!hasValidBook) return { ok: false };

  const bidsRaw = depth.bids!.slice(0, 8).map((b) => ({
    price: safeNum(b[0]),
    size: safeNum(b[1]),
  }));
  const asksRaw = depth
    .asks!.slice(0, 8)
    .map((a) => ({
      price: safeNum(a[0]),
      size: safeNum(a[1]),
    }))
    .reverse();

  const maxBidSize = Math.max(...bidsRaw.map((o) => o.size), 0);
  const maxAskSize = Math.max(...asksRaw.map((o) => o.size), 0);

  const bids: OrderBookRow[] = bidsRaw.map((b) => ({
    side: "bid" as const,
    price: b.price,
    size: b.size,
    barPct: maxBidSize > 0 ? (b.size / maxBidSize) * 100 : 0,
    isWall: b.size > maxBidSize * 0.5,
  }));
  const asks: OrderBookRow[] = asksRaw.map((a) => ({
    side: "ask" as const,
    price: a.price,
    size: a.size,
    barPct: maxAskSize > 0 ? (a.size / maxAskSize) * 100 : 0,
    isWall: a.size > maxAskSize * 0.5,
  }));

  const bestAsk = safeNum(depth.asks![0][0]);
  const bestBid = safeNum(depth.bids![0][0]);
  const spread = bestAsk - bestBid;
  const spreadPct = bestBid > 0 ? ((spread / bestBid) * 100).toFixed(4) : "0";

  const priceLow = currentPrice * 0.98;
  const priceHigh = currentPrice * 1.02;
  let bidDepth2 = 0;
  for (const b of depth.bids!) {
    const p = safeNum(b[0]);
    const sz = safeNum(b[1]);
    if (p >= priceLow) bidDepth2 += p * sz;
  }
  let askDepth2 = 0;
  for (const a of depth.asks!) {
    const p = safeNum(a[0]);
    const sz = safeNum(a[1]);
    if (p <= priceHigh) askDepth2 += p * sz;
  }

  const depthRatio = askDepth2 > 0 ? bidDepth2 / askDepth2 : null;
  let depthRatioNote = "供需均衡";
  let depthRatioColor = "var(--amber)";
  let badgeClass: "badge-green" | "badge-red" | "badge-amber" = "badge-amber";
  let badgeText = "供需均衡";
  if (depthRatio !== null) {
    if (depthRatio > 1.2) {
      depthRatioNote = "买盘较强";
      depthRatioColor = "var(--green)";
      badgeClass = "badge-green";
      badgeText = "买盘偏强";
    } else if (depthRatio < 0.8) {
      depthRatioNote = "卖盘较强";
      depthRatioColor = "var(--red)";
      badgeClass = "badge-red";
      badgeText = "卖盘偏强";
    }
  }

  const maxSizeAll = Math.max(maxBidSize, maxAskSize);
  let wallCount = 0;
  for (const b of depth.bids!.slice(0, 20)) {
    if (safeNum(b[1]) > maxSizeAll * 0.4) wallCount++;
  }
  for (const a of depth.asks!.slice(0, 20)) {
    if (safeNum(a[1]) > maxSizeAll * 0.4) wallCount++;
  }

  const drNum = depthRatio ?? 1;
  let liquidityHtml = "";
  if (drNum > 1.3)
    liquidityHtml = `▲ 买盘强势 — 2%范围内买盘深度是卖盘的${drNum.toFixed(2)}倍，做市商支撑力度强，短期下跌空间有限。`;
  else if (drNum < 0.7)
    liquidityHtml = `▼ 卖盘强势 — 2%范围内卖盘深度是买盘的${(1 / drNum).toFixed(2)}倍，上方抛压较重，短期上涨阻力大。`;
  else liquidityHtml = "→ 供需均衡 — 买卖盘深度比例均衡，市场双向流动性良好，等待方向性突破信号。";
  if (wallCount)
    liquidityHtml += ` 检测到 ${wallCount} 个大单墙。`;

  return {
    ok: true,
    asks,
    bids,
    spread,
    spreadPct,
    bidDepth2Usd: bidDepth2,
    askDepth2Usd: askDepth2,
    depthRatio,
    depthRatioNote,
    depthRatioColor,
    badgeClass,
    badgeText,
    maxBidSize,
    maxAskSize,
    wallCount,
    liquidityHtml,
  };
}

export function groupIndicatorsByGroup(
  indicators: Record<string, IndicatorSignal>,
  group: string
): [string, IndicatorSignal][] {
  return Object.entries(indicators).filter(([, v]) => v.group === group);
}

export function groupBadgeCounts(rows: [string, IndicatorSignal][]) {
  const bulls = rows.filter(([, v]) => v.type === "bull").length;
  const bears = rows.filter(([, v]) => v.type === "bear").length;
  if (bulls > bears) return { className: "panel-badge badge-green" as const, text: `${bulls} 利多` };
  if (bears > bulls) return { className: "panel-badge badge-red" as const, text: `${bears} 利空` };
  return { className: "panel-badge badge-amber" as const, text: "均势" };
}
