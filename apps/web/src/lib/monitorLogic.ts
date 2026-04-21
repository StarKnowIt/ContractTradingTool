/** 监控页纯计算逻辑（便于单测与页面瘦身） */

export type PriceRow = {
  symbol: string;
  price: number;
  change: number;
  volume: number;
  high: number;
  low: number;
};

export type HorseRow = PriceRow & {
  score: number;
  signals: string[];
  volRatio: number;
};

export function sortPriceList(all: PriceRow[], mode: "up" | "down" | "vol", topN: number): PriceRow[] {
  if (!all.length || topN <= 0) return [];
  const slice = (rows: PriceRow[]) => rows.slice(0, topN);
  if (mode === "up") return slice([...all].sort((a, b) => b.change - a.change));
  if (mode === "down") return slice([...all].sort((a, b) => a.change - b.change));
  return slice([...all].sort((a, b) => b.volume - a.volume));
}

export function computeHorseSignals(all: PriceRow[], opts: { topHorse: number }): HorseRow[] {
  const topN = Math.max(1, Math.min(30, opts.topHorse));
  if (!all.length) return [];

  const sortedByVol = [...all].sort((a, b) => b.volume - a.volume);
  const top50 = sortedByVol.slice(0, 50);
  const baseVol = top50[Math.floor(top50.length / 2)]?.volume || 1;

  const scores = all.map((t) => {
    let score = 0;
    const signals: string[] = [];
    if (t.change > 15) {
      score += 5;
      signals.push(`🚀飙升${t.change.toFixed(1)}%`);
    } else if (t.change > 10) {
      score += 4;
      signals.push(`🚀涨幅${t.change.toFixed(1)}%`);
    } else if (t.change > 5) {
      score += 2;
      signals.push(`📈涨幅${t.change.toFixed(1)}%`);
    } else if (t.change > 3) {
      score += 1;
      signals.push(`↑涨幅${t.change.toFixed(1)}%`);
    } else if (t.change <= 0) {
      score -= 3;
    }

    const volRatio = t.volume / baseVol;
    if (volRatio > 5) {
      score += 4;
      signals.push(`🔥爆量${volRatio.toFixed(1)}x`);
    } else if (volRatio > 3) {
      score += 3;
      signals.push(`📊放量${volRatio.toFixed(1)}x`);
    } else if (volRatio > 2) {
      score += 2;
      signals.push(`量能${volRatio.toFixed(1)}x`);
    } else if (volRatio > 1.5) {
      score += 1;
    }

    const majorCoins = ["BTC", "ETH", "BNB", "XRP", "SOL", "USDC", "BUSD"];
    if (majorCoins.includes(t.symbol)) score -= 5;

    if (t.change > 5 && volRatio > 2) {
      score += 3;
      signals.push("⚡价量共振");
    }

    const range = t.high - t.low;
    if (range > 0) {
      const highPct = ((t.price - t.low) / range) * 100;
      if (highPct > 95) {
        score += 2;
        signals.push("突破高点");
      } else if (highPct > 85) {
        score += 1;
        signals.push("近高点");
      }
    }

    return { ...t, score, signals, volRatio };
  });

  return scores
    .filter((t) => t.score >= 4 && t.change > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
