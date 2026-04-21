import { analyzeAll } from "@/lib/legacy/indicators.js";

type Ind = { type: string; value: string };

export type EventSuggestionOk = {
  ok: true;
  directionLabel: string;
  directionColor: string;
  confidenceLabel: string;
  confidenceColor: string;
  reasonsText: string;
  badgeClass: "badge-green" | "badge-red" | "badge-amber";
  badgeText: string;
  meta: {
    direction: "up" | "down" | "neutral";
    score: number;
    confidence: string;
  };
};

export type EventSuggestionResult = { ok: false; reason: string } | EventSuggestionOk;

/**
 * 与 legacy `js/event.js` 中 `evCalcSuggestion` 的打分与展示文案一致（输入为原始 K 线数组）。
 */
export function calcEventSuggestion(
  klines: (string | number)[][] | null | undefined,
  durationMinutes: number
): EventSuggestionResult {
  if (!klines || klines.length < 20) {
    return { ok: false, reason: "数据不足" };
  }

  let indicators: Record<string, Ind & { desc?: string }>;
  try {
    indicators = analyzeAll(klines).indicators as Record<string, Ind & { desc?: string }>;
  } catch {
    return { ok: false, reason: "数据不足" };
  }

  let score = 0;
  const bullReasons: string[] = [];
  const bearReasons: string[] = [];

  const isShort = durationMinutes <= 10;
  const isMid = durationMinutes <= 60;

  const rsiVal = indicators.rsi;
  if (rsiVal) {
    const r = parseFloat(rsiVal.value);
    if (!isNaN(r)) {
      if (r > 55) {
        score += isShort ? 2 : 1;
        bullReasons.push(`RSI强势(${r.toFixed(0)})`);
      } else if (r < 45) {
        score -= isShort ? 2 : 1;
        bearReasons.push(`RSI弱势(${r.toFixed(0)})`);
      }
    }
  }

  const macdVal = indicators.macd;
  if (macdVal) {
    if (macdVal.type === "bull") {
      score += isShort ? 2 : 1;
      bullReasons.push("MACD金叉");
    } else if (macdVal.type === "bear") {
      score -= isShort ? 2 : 1;
      bearReasons.push("MACD死叉");
    }
  }

  const stochVal = indicators.stochrsi;
  if (stochVal) {
    if (stochVal.type === "bull") {
      score += 1;
      bullReasons.push("StochRSI超卖金叉");
    } else if (stochVal.type === "bear") {
      score -= 1;
      bearReasons.push("StochRSI超买死叉");
    }
  }

  const kdjVal = indicators.kdj;
  if (kdjVal) {
    if (kdjVal.type === "bull") {
      score += 1;
      bullReasons.push("KDJ金叉");
    } else if (kdjVal.type === "bear") {
      score -= 1;
      bearReasons.push("KDJ死叉");
    }
  }

  if (!isShort) {
    const emaVal = indicators.ema;
    if (emaVal) {
      if (emaVal.type === "bull") {
        score += 2;
        bullReasons.push("EMA多头排列");
      } else if (emaVal.type === "bear") {
        score -= 2;
        bearReasons.push("EMA空头排列");
      }
    }

    const bollVal = indicators.boll;
    if (bollVal) {
      if (bollVal.type === "bull") {
        score += 1;
        bullReasons.push("布林带下轨支撑");
      } else if (bollVal.type === "bear") {
        score -= 1;
        bearReasons.push("布林带上轨压力");
      }
    }

    const adxVal = indicators.adx;
    if (adxVal && adxVal.type !== "neutral") {
      if (adxVal.type === "bull") {
        score += 1;
        bullReasons.push("ADX趋势增强");
      }
    }

    const vwapVal = indicators.vwap;
    if (vwapVal) {
      if (vwapVal.type === "bull") {
        score += 1;
        bullReasons.push("价格在VWAP上方");
      } else if (vwapVal.type === "bear") {
        score -= 1;
        bearReasons.push("价格在VWAP下方");
      }
    }
  }

  if (!isMid) {
    const ichVal = indicators.ichimoku;
    if (ichVal) {
      if (ichVal.type === "bull") {
        score += 2;
        bullReasons.push("一目均衡表看多");
      } else if (ichVal.type === "bear") {
        score -= 2;
        bearReasons.push("一目均衡表看空");
      }
    }

    const wyckoffVal = indicators.wyckoff;
    if (wyckoffVal) {
      if (wyckoffVal.type === "bull") {
        score += 1;
        bullReasons.push(`威科夫${wyckoffVal.value}`);
      } else if (wyckoffVal.type === "bear") {
        score -= 1;
        bearReasons.push(`威科夫${wyckoffVal.value}`);
      }
    }
  }

  const paVal = indicators.pa;
  if (paVal) {
    if (paVal.type === "bull") {
      score += 2;
      bullReasons.push(`PA结构看多(${paVal.value})`);
    } else if (paVal.type === "bear") {
      score -= 2;
      bearReasons.push(`PA结构看空(${paVal.value})`);
    }
  }

  const volVal = indicators.volume;
  if (volVal) {
    if (volVal.type === "bull") {
      score += 1;
      bullReasons.push("成交量放大确认");
    } else if (volVal.type === "bear") {
      score -= 1;
      bearReasons.push("成交量萎缩");
    }
  }

  const allVals = Object.values(indicators);
  const totalBulls = allVals.filter((v) => v.type === "bull").length;
  const totalBears = allVals.filter((v) => v.type === "bear").length;
  const techBias = totalBulls - totalBears;
  if (techBias >= 5) {
    score += 2;
    bullReasons.push(`综合指标偏多(${totalBulls}利多)`);
  } else if (techBias <= -5) {
    score -= 2;
    bearReasons.push(`综合指标偏空(${totalBears}利空)`);
  }

  let directionLabel: string;
  let directionColor: string;
  let confidenceLabel: string;
  let confidenceColor: string;

  if (score >= 6) {
    directionLabel = "▲ 看涨";
    directionColor = "var(--green)";
    confidenceLabel = "强烈";
    confidenceColor = "var(--green)";
  } else if (score >= 3) {
    directionLabel = "▲ 看涨";
    directionColor = "var(--green)";
    confidenceLabel = "一般";
    confidenceColor = "#8bc34a";
  } else if (score >= 1) {
    directionLabel = "▲ 看涨";
    directionColor = "#8bc34a";
    confidenceLabel = "偏弱";
    confidenceColor = "var(--gold)";
  } else if (score <= -6) {
    directionLabel = "▼ 看跌";
    directionColor = "var(--red)";
    confidenceLabel = "强烈";
    confidenceColor = "var(--red)";
  } else if (score <= -3) {
    directionLabel = "▼ 看跌";
    directionColor = "var(--red)";
    confidenceLabel = "一般";
    confidenceColor = "#ff9800";
  } else if (score <= -1) {
    directionLabel = "▼ 看跌";
    directionColor = "#ff9800";
    confidenceLabel = "偏弱";
    confidenceColor = "var(--gold)";
  } else {
    directionLabel = "→ 观望";
    directionColor = "var(--gold)";
    confidenceLabel = "信号不明";
    confidenceColor = "var(--gold)";
  }

  const reasons =
    score >= 0
      ? [...bullReasons.slice(0, 3), ...bearReasons.slice(0, 1)]
      : [...bearReasons.slice(0, 3), ...bullReasons.slice(0, 1)];

  const reasonsText = reasons.join(" · ") || "指标信号不明朗";

  const badgeClass: EventSuggestionOk["badgeClass"] =
    score > 2 ? "badge-green" : score < -2 ? "badge-red" : "badge-amber";
  const badgeText = score > 2 ? "建议看涨" : score < -2 ? "建议看跌" : "建议观望";

  return {
    ok: true,
    directionLabel,
    directionColor,
    confidenceLabel,
    confidenceColor,
    reasonsText,
    badgeClass,
    badgeText,
    meta: {
      direction: score > 0 ? "up" : score < 0 ? "down" : "neutral",
      score,
      confidence: confidenceLabel,
    },
  };
}
