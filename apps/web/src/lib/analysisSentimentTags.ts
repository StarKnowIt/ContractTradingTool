/**
 * 从 legacy `js/render.js` 的 `renderSentimentTags` 抽离为纯函数：
 * 输入指标 + 资金费率(百分比数值) + 恐惧贪婪 + 多空比 + 可选斐波那契百分位。
 */

export type IndicatorSignal = {
  type: string;
  value: string;
  desc?: string;
  bar?: number;
  group?: string;
};

export type SentimentTag = { text: string; cls: "badge-green" | "badge-red" | "badge-amber" | "badge-blue" };

export function buildSentimentTagsAndAdvice(
  indicators: Record<string, IndicatorSignal>,
  fundingRatePct: number | null,
  fgVal: string | number | null,
  lsRatio: number | null,
  fibPct?: number | null
): { tags: SentimentTag[]; advice: string } {
  const tags: SentimentTag[] = [];
  const all = Object.values(indicators);
  const bulls = all.filter((v) => v.type === "bull").length;
  const bears = all.filter((v) => v.type === "bear").length;

  if (indicators.ema?.type === "bull" && indicators.ema200?.type === "bull")
    tags.push({ text: "均线多头排列", cls: "badge-green" });
  else if (indicators.ema?.type === "bear" && indicators.ema200?.type === "bear")
    tags.push({ text: "均线空头排列", cls: "badge-red" });
  else if (indicators.ema?.type === "bull") tags.push({ text: "均线短期偏多", cls: "badge-green" });
  else if (indicators.ema?.type === "bear") tags.push({ text: "均线短期偏空", cls: "badge-red" });

  if (indicators.ema200?.type === "bull") tags.push({ text: "EMA200多头支撑", cls: "badge-green" });
  else if (indicators.ema200?.type === "bear") tags.push({ text: "跌破EMA200", cls: "badge-red" });

  if (indicators.maArrange?.type === "bull") tags.push({ text: "五线多头完美排列", cls: "badge-green" });
  else if (indicators.maArrange?.type === "bear") tags.push({ text: "五线空头完美排列", cls: "badge-red" });

  if (indicators.ma2060?.type === "bull") tags.push({ text: "MA20/60中期金叉", cls: "badge-green" });
  else if (indicators.ma2060?.type === "bear") tags.push({ text: "MA20/60中期死叉", cls: "badge-red" });

  if (indicators.ma510?.type === "bull") tags.push({ text: "MA5/10短期金叉", cls: "badge-green" });
  else if (indicators.ma510?.type === "bear") tags.push({ text: "MA5/10短期死叉", cls: "badge-red" });

  if (indicators.ichimoku?.type === "bull") tags.push({ text: "一目云层上方", cls: "badge-green" });
  else if (indicators.ichimoku?.type === "bear") tags.push({ text: "一目云层下方", cls: "badge-red" });
  else if (indicators.ichimoku?.type === "neutral") tags.push({ text: "一目云内震荡", cls: "badge-amber" });

  if (indicators.adx) {
    const adxVal = parseFloat(indicators.adx.value);
    if (adxVal > 30 && indicators.adx.type === "bull")
      tags.push({ text: `ADX强势多头(${adxVal.toFixed(0)})`, cls: "badge-green" });
    else if (adxVal > 30 && indicators.adx.type === "bear")
      tags.push({ text: `ADX强势空头(${adxVal.toFixed(0)})`, cls: "badge-red" });
    else if (adxVal < 20) tags.push({ text: `ADX盘整弱势(${adxVal.toFixed(0)})`, cls: "badge-amber" });
  }

  if (indicators.macd?.type === "bull") tags.push({ text: "MACD金叉", cls: "badge-green" });
  else if (indicators.macd?.type === "bear") tags.push({ text: "MACD死叉", cls: "badge-red" });
  else tags.push({ text: "MACD中性", cls: "badge-amber" });

  if (indicators.boll?.type === "bull") tags.push({ text: "布林带下轨支撑", cls: "badge-green" });
  else if (indicators.boll?.type === "bear") tags.push({ text: "布林带上轨压力", cls: "badge-red" });
  if (indicators.bw && parseFloat(indicators.bw.value) < 3)
    tags.push({ text: "布林带收缩蓄势", cls: "badge-blue" });
  else if (indicators.bw && parseFloat(indicators.bw.value) > 10)
    tags.push({ text: "布林带极度扩张", cls: "badge-amber" });

  if (indicators.vegasTrend?.type === "bull") tags.push({ text: "维加斯通道多头", cls: "badge-green" });
  else if (indicators.vegasTrend?.type === "bear") tags.push({ text: "维加斯通道空头", cls: "badge-red" });
  else if (indicators.vegasTrend?.type === "neutral") tags.push({ text: "维加斯通道内震荡", cls: "badge-amber" });

  if (indicators.rsi) {
    const rv = parseFloat(indicators.rsi.value);
    if (rv < 30) tags.push({ text: `RSI超卖(${rv.toFixed(0)})`, cls: "badge-green" });
    else if (rv > 70) tags.push({ text: `RSI超买(${rv.toFixed(0)})`, cls: "badge-red" });
    else if (rv > 50) tags.push({ text: `RSI强势区(${rv.toFixed(0)})`, cls: "badge-green" });
    else tags.push({ text: `RSI弱势区(${rv.toFixed(0)})`, cls: "badge-red" });
  }

  if (indicators.kdj?.type === "bull") tags.push({ text: "KDJ金叉", cls: "badge-green" });
  else if (indicators.kdj?.type === "bear") tags.push({ text: "KDJ死叉", cls: "badge-red" });

  if (indicators.stochrsi?.type === "bull") tags.push({ text: "StochRSI超卖金叉", cls: "badge-green" });
  else if (indicators.stochrsi?.type === "bear") tags.push({ text: "StochRSI超买死叉", cls: "badge-red" });

  if (indicators.williamsr?.type === "bull") tags.push({ text: "WR超卖区间", cls: "badge-green" });
  else if (indicators.williamsr?.type === "bear") tags.push({ text: "WR超买区间", cls: "badge-red" });

  if (indicators.cci?.type === "bull") tags.push({ text: `CCI超卖(${indicators.cci.value})`, cls: "badge-green" });
  else if (indicators.cci?.type === "bear") tags.push({ text: `CCI超买(${indicators.cci.value})`, cls: "badge-red" });

  if (indicators.roc?.type === "bull") tags.push({ text: `ROC正向动能(${indicators.roc.value})`, cls: "badge-green" });
  else if (indicators.roc?.type === "bear") tags.push({ text: `ROC负向动能(${indicators.roc.value})`, cls: "badge-red" });

  if (indicators.volume?.type === "bull") tags.push({ text: "放量上涨", cls: "badge-green" });
  else if (indicators.volume?.type === "bear") tags.push({ text: "放量下跌", cls: "badge-red" });

  if (indicators.obv?.type === "bull") tags.push({ text: "OBV资金流入", cls: "badge-green" });
  else if (indicators.obv?.type === "bear") tags.push({ text: "OBV资金流出", cls: "badge-red" });

  if (indicators.cmf?.type === "bull") tags.push({ text: "CMF资金持续流入", cls: "badge-green" });
  else if (indicators.cmf?.type === "bear") tags.push({ text: "CMF资金持续流出", cls: "badge-red" });

  if (indicators.mfi?.type === "bull") tags.push({ text: `MFI超卖(${indicators.mfi.value})`, cls: "badge-green" });
  else if (indicators.mfi?.type === "bear") tags.push({ text: `MFI超买(${indicators.mfi.value})`, cls: "badge-red" });

  if (indicators.vwap?.type === "bull") tags.push({ text: "VWAP上方多头", cls: "badge-green" });
  else if (indicators.vwap?.type === "bear") tags.push({ text: "VWAP下方空头", cls: "badge-red" });

  if (indicators.donchian?.type === "bull") tags.push({ text: "唐奇安通道下轨", cls: "badge-green" });
  else if (indicators.donchian?.type === "bear") tags.push({ text: "唐奇安通道上轨", cls: "badge-red" });

  if (indicators.atr) {
    const atrVal = parseFloat(indicators.atr.value);
    if (atrVal > 3) tags.push({ text: `ATR高波动(${atrVal.toFixed(1)}%)`, cls: "badge-amber" });
    else if (atrVal < 0.8) tags.push({ text: `ATR低波动(${atrVal.toFixed(1)}%)`, cls: "badge-blue" });
  }

  if (indicators.vegasTrend && fibPct != null && Number.isFinite(fibPct)) {
    if (fibPct < 38.2) tags.push({ text: `斐波那契支撑区(${fibPct.toFixed(1)}%)`, cls: "badge-green" });
    else if (fibPct > 61.8) tags.push({ text: `斐波那契压力区(${fibPct.toFixed(1)}%)`, cls: "badge-red" });
    else if (fibPct >= 38.2 && fibPct <= 61.8)
      tags.push({ text: `斐波那契黄金区(${fibPct.toFixed(1)}%)`, cls: "badge-amber" });
  }

  if (indicators.vegasEma12?.type === "bull") tags.push({ text: "EMA12突破维加斯通道", cls: "badge-green" });
  else if (indicators.vegasEma12?.type === "bear") tags.push({ text: "EMA12跌破维加斯通道", cls: "badge-red" });

  if (fundingRatePct !== null && Number.isFinite(fundingRatePct)) {
    const fr = fundingRatePct;
    if (fr > 0.1) tags.push({ text: `资金费率偏高 ${fr.toFixed(3)}%`, cls: "badge-red" });
    else if (fr > 0.05) tags.push({ text: `资金费率偏高 ${fr.toFixed(3)}%`, cls: "badge-amber" });
    else if (fr < -0.05) tags.push({ text: `资金费率为负 ${fr.toFixed(3)}%`, cls: "badge-green" });
    else tags.push({ text: `资金费率正常 ${fr.toFixed(3)}%`, cls: "badge-blue" });
  }

  if (lsRatio !== null && Number.isFinite(lsRatio)) {
    if (lsRatio > 1.3) tags.push({ text: `多空比偏多(${lsRatio.toFixed(2)})`, cls: "badge-green" });
    else if (lsRatio < 0.77) tags.push({ text: `多空比偏空(${lsRatio.toFixed(2)})`, cls: "badge-red" });
    else tags.push({ text: `多空比均衡(${lsRatio.toFixed(2)})`, cls: "badge-blue" });
  }

  if (fgVal !== null && fgVal !== undefined && fgVal !== "") {
    const fv = parseInt(String(fgVal), 10);
    if (!Number.isNaN(fv)) {
      if (fv > 75) tags.push({ text: `极度贪婪(${fv})`, cls: "badge-red" });
      else if (fv > 60) tags.push({ text: `市场贪婪(${fv})`, cls: "badge-amber" });
      else if (fv < 25) tags.push({ text: `极度恐惧(${fv})`, cls: "badge-green" });
      else if (fv < 40) tags.push({ text: `市场恐惧(${fv})`, cls: "badge-amber" });
      else tags.push({ text: `情绪中性(${fv})`, cls: "badge-blue" });
    }
  }

  const order: Record<string, number> = { "badge-green": 0, "badge-red": 1, "badge-amber": 2, "badge-blue": 3 };
  tags.sort((a, b) => (order[a.cls] ?? 3) - (order[b.cls] ?? 3));

  const longScore = (bulls / (bulls + bears || 1)) * 100;
  const macdSig = indicators.macd?.type;
  const rsiVal = indicators.rsi ? parseFloat(indicators.rsi.value) : 50;
  const ema200Sig = indicators.ema200?.type;
  const bollSig = indicators.boll?.type;

  let advice = "";
  if (longScore >= 70) {
    advice =
      `多数指标共振看多（利多${bulls}项 / 利空${bears}项）。` +
      (macdSig === "bull" ? "MACD金叉确认，" : "") +
      (rsiVal < 50 ? `RSI尚未超买(${rsiVal.toFixed(0)})，上行空间充足，` : "") +
      (ema200Sig === "bull" ? "EMA200强势支撑，" : "") +
      "建议顺势轻仓做多，在关键支撑位设置止损，分批建仓降低风险。";
  } else if (longScore <= 30) {
    advice =
      `多数指标共振看空（利空${bears}项 / 利多${bulls}项）。` +
      (macdSig === "bear" ? "MACD死叉压制，" : "") +
      (rsiVal > 50 ? `RSI尚未超卖(${rsiVal.toFixed(0)})，下行风险仍存，` : "") +
      (ema200Sig === "bear" ? "跌破EMA200，趋势转弱，" : "") +
      "建议观望或轻仓做空，严格设置止损，避免重仓逆势操作。";
  } else if (longScore >= 55) {
    advice =
      `指标偏多但信号不强烈（利多${bulls} / 利空${bears} / 中性${all.length - bulls - bears}）。` +
      (bollSig === "bull" ? "布林带下轨提供支撑，" : "") +
      "可轻仓试多，重点关注能否有效守住关键均线，不建议重仓追涨。";
  } else if (longScore <= 45) {
    advice =
      `指标略偏空但分歧较大（利空${bears} / 利多${bulls} / 中性${all.length - bulls - bears}）。` +
      "建议以观望为主，等待方向明朗。" +
      (bollSig === "bear" ? "布林带上轨有压力，短线谨慎追多。" : "");
  } else {
    advice =
      `多空信号基本均衡（利多${bulls} / 利空${bears} / 中性${all.length - bulls - bears}），市场处于震荡整理阶段。` +
      "建议等待趋势突破信号出现，重点关注成交量是否能有效配合方向性行情。";
  }

  return { tags, advice };
}
