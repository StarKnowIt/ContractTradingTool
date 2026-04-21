"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson, fetchJsonOptional } from "@/lib/api";
import { analyzeAll } from "@/lib/legacy/indicators.js";
import {
  computeCompositeScore,
  computeNewsSentimentLabel,
  groupBadgeCounts,
  groupIndicatorsByGroup,
  INDICATOR_GROUPS,
  INDICATOR_NAME_MAP,
  summarizeOrderBook,
  type CompositeScoreView,
  type NewsSentimentLabel,
  type OrderBookSummary,
} from "@/lib/analysisFlow";
import { buildSentimentTagsAndAdvice, type IndicatorSignal, type SentimentTag } from "@/lib/analysisSentimentTags";
import { USDT_BASE_OPTIONS } from "@/lib/usdtBaseOptions";

type Ticker = {
  lastPrice: string;
  priceChangePercent: string;
  priceChange: string;
  highPrice: string;
  lowPrice: string;
  quoteVolume: string;
};

function fmt(n: number, dec = 2) {
  if (!Number.isFinite(n)) return "--";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return Number(n.toFixed(dec)).toString();
}

function fmtPrice(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "--";
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function drawMiniChart(canvas: HTMLCanvasElement | null, closes: number[]) {
  if (!canvas || closes.length < 2) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cw = canvas.width || 200;
  const ch = canvas.height || 60;
  ctx.clearRect(0, 0, cw, ch);

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const padX = 4;
  const padTop = 4;
  const usableW = Math.max(1, cw - padX * 2);
  const usableH = Math.max(1, ch - 8);

  const points = closes.map((c, i) => ({
    x: padX + (i / (closes.length - 1)) * usableW,
    y: padTop + (1 - (c - min) / range) * usableH,
  }));

  const isUp = closes[closes.length - 1] >= closes[0];
  const lineColor = isUp ? "#00e676" : "#ff3d57";
  const fillColor = isUp ? "rgba(0,230,118,0.14)" : "rgba(255,61,87,0.14)";

  ctx.beginPath();
  ctx.moveTo(points[0].x, ch - 2);
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, ch - 2);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function SignalPill({ type }: { type: string }) {
  const map: Record<string, [string, string]> = {
    bull: ["signal-pill signal-bull", "▲ 利多"],
    bear: ["signal-pill signal-bear", "▼ 利空"],
    neutral: ["signal-pill signal-neutral", "→ 中性"],
  };
  const [cls, label] = map[type] || map.neutral;
  return <span className={cls}>{label}</span>;
}

function IndicatorRow({ id, name, ind }: { id: string; name: string; ind: IndicatorSignal }) {
  const barColor = ind.type === "bull" ? "green" : ind.type === "bear" ? "red" : "amber";
  const bar = ind.bar ?? 50;
  return (
    <div className="indicator-row" id={`row-${id}`}>
      <div className="ind-name">{name}</div>
      <div>
        <div className="ind-bar-wrap">
          <div className={`ind-bar ${barColor}`} style={{ width: `${bar}%` }} />
        </div>
        <div className="ind-desc" style={{ marginTop: 3, fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)" }}>
          {ind.desc}
        </div>
      </div>
      <div className="ind-value">{ind.value}</div>
      <SignalPill type={ind.type} />
    </div>
  );
}

export default function AnalysisPage() {
  const [base, setBase] = useState("BTC");
  const [interval, setInterval] = useState("1h");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");

  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [closesMini, setClosesMini] = useState<number[]>([]);

  const [composite, setComposite] = useState<CompositeScoreView | null>(null);
  const [newsSent, setNewsSent] = useState<NewsSentimentLabel | null>(null);
  const [sentimentTags, setSentimentTags] = useState<SentimentTag[]>([]);
  const [tradingAdvice, setTradingAdvice] = useState("");

  const [fundingPct, setFundingPct] = useState<number | null>(null);
  const [fundingNote, setFundingNote] = useState("");
  const [oiDisplay, setOiDisplay] = useState({ main: "N/A", sub: "" });
  const [lsView, setLsView] = useState<{ longPct: number; shortPct: number; ratio: number } | null>(null);
  const [fgView, setFgView] = useState<{ value: string; classification: string } | null>(null);

  const [orderBook, setOrderBook] = useState<OrderBookSummary>({ ok: false });
  const [indicators, setIndicators] = useState<Record<string, IndicatorSignal> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const symbol = useMemo(() => `${base.toUpperCase()}USDT`, [base]);

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const [klines, t, funding, oi, ls, fg, depth] = await Promise.all([
        fetchJson<(number | string)[][]>(
          `/api/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=300`
        ),
        fetchJsonOptional<Ticker>(`/api/ticker?symbol=${encodeURIComponent(symbol)}`),
        fetchJsonOptional<{ fundingRate?: string }[]>(`/api/funding?symbol=${encodeURIComponent(symbol)}`),
        fetchJsonOptional<{ openInterest?: string }>(`/api/oi?symbol=${encodeURIComponent(symbol)}`),
        fetchJsonOptional<{ longAccount?: string; shortAccount?: string; longShortRatio?: string }[]>(
          `/api/ls?symbol=${encodeURIComponent(symbol)}`
        ),
        fetchJsonOptional<{ data?: { value?: string; value_classification?: string }[] }>(`/api/fg`),
        fetchJsonOptional<{ bids?: unknown[][]; asks?: unknown[][] }>(
          `/api/depth?symbol=${encodeURIComponent(symbol)}&limit=20`
        ),
      ]);

      if (!Array.isArray(klines) || klines.length === 0) {
        setErr("该币种暂无K线数据，可能刚上线或已下架");
        setLoading(false);
        return;
      }

      setTicker(t);
      const analyzed = analyzeAll(klines);
      const ind = analyzed.indicators as Record<string, IndicatorSignal>;
      setIndicators(ind);

      const closes = analyzed.closes;
      setClosesMini(closes.slice(-60));

      setComposite(computeCompositeScore(ind));

      let frPct: number | null = null;
      if (funding?.length) {
        const fr = parseFloat(String(funding[0].fundingRate ?? 0)) * 100;
        frPct = fr;
        setFundingPct(fr);
        setFundingNote(fr > 0.1 ? "偏高，多头付费" : fr < -0.05 ? "为负，空头付费" : "正常范围");
      } else {
        setFundingPct(null);
        setFundingNote("现货交易对或暂无数据");
      }

      if (oi?.openInterest) {
        const oiN = parseFloat(String(oi.openInterest));
        setOiDisplay({ main: fmt(oiN), sub: `${base.toUpperCase()} 合约持仓` });
      } else {
        setOiDisplay({ main: "N/A", sub: "" });
      }

      let lsRatio: number | null = null;
      if (ls?.length) {
        const row = ls[0];
        const lp = parseFloat(String(row.longAccount ?? 0));
        const sp = parseFloat(String(row.shortAccount ?? 0));
        if (sp > 0) lsRatio = lp / sp;
        else if (row.longShortRatio !== undefined) lsRatio = parseFloat(String(row.longShortRatio));
        setLsView({
          longPct: lp * 100,
          shortPct: sp * 100,
          ratio: lsRatio ?? 0,
        });
      } else {
        setLsView(null);
      }

      let fgVal: string | null = null;
      if (fg?.data?.[0]) {
        const d = fg.data[0];
        fgVal = d.value != null ? String(d.value) : null;
        setFgView({
          value: fgVal ?? "--",
          classification: d.value_classification ?? "",
        });
      } else {
        setFgView(null);
      }

      const lastPrice = parseFloat(String(klines[klines.length - 1][4]));
      setOrderBook(summarizeOrderBook(depth, lastPrice));

      setNewsSent(
        computeNewsSentimentLabel(ind, fg ?? null, funding ?? null, ls?.[0] ?? ls ?? null)
      );

      const tagRes = buildSentimentTagsAndAdvice(ind, frPct, fgVal, lsRatio, analyzed.fib?.pct ?? null);
      setSentimentTags(tagRes.tags);
      setTradingAdvice(tagRes.advice);

      const now = new Date();
      setLastUpdate(
        `更新于 ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [base, interval, symbol]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    drawMiniChart(canvasRef.current, closesMini);
  }, [closesMini]);

  const last = ticker ? parseFloat(ticker.lastPrice) : 0;
  const chgPct = ticker ? parseFloat(ticker.priceChangePercent) : 0;
  const isUp = chgPct >= 0;

  return (
    <main style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="section-label">技术分析</div>

      {err ? (
        <div className="error-banner show" style={{ display: "flex" }}>
          {err}
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-header" style={{ gap: 8, flexWrap: "wrap" }}>
          <div className="panel-title">行情概览</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="form-select input-monospace select-sm"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              style={{ width: 120, minWidth: 0 }}
              aria-label="USDT 本位币种"
            >
              {USDT_BASE_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              className="form-select input-monospace select-sm"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            >
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1d">1d</option>
            </select>
            <button
              className="btn secondary"
              disabled={loading}
              onClick={() => load().catch(() => {})}
              style={{ padding: "6px 10px" }}
            >
              {loading ? "加载中…" : "刷新"}
            </button>
            {lastUpdate ? (
              <span style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", fontFamily: "var(--mono)" }}>{lastUpdate}</span>
            ) : null}
          </div>
        </div>

        <div className="panel-body">
          <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
            <div style={{ minWidth: 240 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-xs)", color: "var(--text-muted)" }}>
                {base.toUpperCase()}/USDT
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "var(--ctbox-text-display-sm)",
                  fontWeight: 800,
                  color: isUp ? "var(--green)" : "var(--red)",
                }}
              >
                {last ? `$${fmtPrice(last)}` : "--"}
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-xs)", color: isUp ? "var(--green)" : "var(--red)" }}>
                {ticker ? `${isUp ? "+" : ""}${chgPct.toFixed(2)}%` : "--"}
              </div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="futures-card">
                  <div className="futures-card-label">24H HIGH</div>
                  <div className="futures-card-value">
                    {ticker ? `$${fmtPrice(parseFloat(ticker.highPrice))}` : "--"}
                  </div>
                </div>
                <div className="futures-card">
                  <div className="futures-card-label">24H LOW</div>
                  <div className="futures-card-value">
                    {ticker ? `$${fmtPrice(parseFloat(ticker.lowPrice))}` : "--"}
                  </div>
                </div>
                <div className="futures-card">
                  <div className="futures-card-label">24H VOL</div>
                  <div className="futures-card-value">
                    {ticker ? `$${fmt(parseFloat(ticker.quoteVolume))}` : "--"}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 260, display: "flex", alignItems: "center" }}>
              <canvas
                ref={canvasRef}
                width={200}
                height={60}
                style={{ width: "100%", height: 70, borderRadius: 10, background: "var(--bg2)" }}
              />
            </div>
          </div>
        </div>
      </div>

      {composite ? (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">综合评分</div>
            <span className={`panel-badge ${composite.badgeClass}`}>{composite.badgeText}</span>
          </div>
          <div className="panel-body">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-2xl)", fontWeight: 800, color: composite.verdictColor }}>
                {composite.verdict}
              </span>
              <span style={{ fontSize: "var(--ctbox-text-xs)", color: "var(--text-muted)" }}>
                利多 {composite.bulls} / 利空 {composite.bears} / 中性 {composite.neutral}
              </span>
            </div>
            <div className="news-summary-bar" style={{ height: 8 }}>
              <div className="bull-seg" style={{ width: `${composite.longPct}%` }} />
              <div className="bear-seg" style={{ width: `${composite.shortPct}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
              <span>看多 {composite.longPct}%</span>
              <span>看空 {composite.shortPct}%</span>
            </div>
          </div>
        </div>
      ) : null}

      {newsSent ? (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">新闻情绪（聚合）</div>
          </div>
          <div className="panel-body">
            <div style={{ fontSize: "var(--ctbox-text-xl)", fontWeight: 800, marginBottom: 6, color: newsSent.color }}>{newsSent.label}</div>
            <div style={{ fontSize: "var(--ctbox-text-xs)", color: "var(--text-dim)", lineHeight: 1.6 }}>{newsSent.desc}</div>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">情绪标签与建议</div>
        </div>
        <div className="panel-body">
          <div className="sentiment-tags" style={{ marginBottom: 12 }}>
            {sentimentTags.length ? (
              sentimentTags.map((t, i) => (
                <span key={`${t.text}-${i}`} className={`sentiment-tag ${t.cls}`} style={{ border: "1px solid", opacity: 0.95, fontSize: "var(--ctbox-text-xs)" }}>
                  {t.text}
                </span>
              ))
            ) : (
              <span style={{ color: "var(--text-muted)", fontSize: "var(--ctbox-text-xs)" }}>加载后显示</span>
            )}
          </div>
          <div style={{ fontSize: "var(--ctbox-text-xs)", color: "var(--text-dim)", lineHeight: 1.7 }}>{tradingAdvice || "—"}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">资金费率 · 持仓 · 多空 · 恐惧贪婪</div>
        </div>
        <div className="panel-body">
          <div className="futures-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
            <div className="futures-card">
              <div className="futures-card-label">资金费率</div>
              <div className="futures-card-value" style={{ color: fundingPct != null && fundingPct > 0 ? "var(--red)" : fundingPct != null && fundingPct < 0 ? "var(--green)" : "var(--text)" }}>
                {fundingPct != null ? `${fundingPct.toFixed(4)}%` : "N/A"}
              </div>
              <div className="futures-card-sub">{fundingNote}</div>
            </div>
            <div className="futures-card">
              <div className="futures-card-label">持仓量 OI</div>
              <div className="futures-card-value">{oiDisplay.main}</div>
              <div className="futures-card-sub">{oiDisplay.sub}</div>
            </div>
            <div className="futures-card">
              <div className="futures-card-label">多空账户比</div>
              {lsView ? (
                <>
                  <div className="futures-card-value" style={{ color: lsView.ratio > 1 ? "var(--green)" : "var(--red)" }}>
                    {lsView.ratio > 0 ? lsView.ratio.toFixed(2) : "N/A"}
                  </div>
                  <div className="ls-bar-track" style={{ marginTop: 8 }}>
                    <div className="ls-bar-long" style={{ width: `${lsView.longPct}%` }}>
                      {lsView.longPct.toFixed(1)}%
                    </div>
                    <div className="ls-bar-short" style={{ flex: 1 }}>
                      {lsView.shortPct.toFixed(1)}%
                    </div>
                  </div>
                </>
              ) : (
                <div className="futures-card-value">N/A</div>
              )}
            </div>
            <div className="futures-card">
              <div className="futures-card-label">恐惧贪婪</div>
              {fgView ? (
                <div className="fg-row">
                  <div className="fg-number" style={{ color: "var(--gold)" }}>
                    {fgView.value}
                  </div>
                  <div>
                    <div className="fg-label">{fgView.classification || "—"}</div>
                  </div>
                </div>
              ) : (
                <div className="futures-card-value">--</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {orderBook.ok ? (
        <OrderBookPanel book={orderBook} fmt={fmt} fmtPrice={fmtPrice} />
      ) : (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">订单簿深度</div>
            <span className="panel-badge badge-amber">N/A</span>
          </div>
          <div className="panel-body">
            <div style={{ color: "var(--text-muted)", fontSize: "var(--ctbox-text-xs)" }}>订单簿数据不可用（现货交易对或接口失败）</div>
          </div>
        </div>
      )}

      {indicators ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {INDICATOR_GROUPS.map(({ id, title }) => {
            const rows = groupIndicatorsByGroup(indicators, id);
            if (!rows.length) return null;
            const badge = groupBadgeCounts(rows);
            return (
              <div key={id} className="panel">
                <div className="panel-header">
                  <div className="panel-title">{title}</div>
                  <span className={badge.className}>{badge.text}</span>
                </div>
                <div className="panel-body">
                  <div className="indicator-list">
                    {rows.map(([k, v]) => (
                      <IndicatorRow key={k} id={k} name={INDICATOR_NAME_MAP[k] || k} ind={v} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

    </main>
  );
}

function OrderBookPanel({
  book,
  fmt,
  fmtPrice,
}: {
  book: Extract<OrderBookSummary, { ok: true }>;
  fmt: (n: number, d?: number) => string;
  fmtPrice: (n: number) => string;
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">订单簿（约 ±2% 深度）</div>
        <span className={`panel-badge ${book.badgeClass}`}>{book.badgeText}</span>
      </div>
      <div className="panel-body">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", marginBottom: 6 }}>卖盘</div>
            {book.asks.map((a, i) => (
              <div
                key={`a-${i}`}
                className="ob-row"
                style={a.isWall ? { background: "rgba(255,61,87,0.06)", borderRadius: 4 } : undefined}
              >
                <div className="ob-price" style={{ color: "var(--red)" }}>
                  {fmtPrice(a.price)}
                </div>
                <div className="ob-bar-wrap">
                  <div className="ob-bar ask" style={{ width: `${a.barPct}%` }} />
                </div>
                <div className="ob-size" style={{ color: a.isWall ? "var(--red)" : undefined }}>
                  {fmt(a.size, 2)}
                  {a.isWall ? " 🧱" : ""}
                </div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", marginBottom: 6 }}>买盘</div>
            {book.bids.map((b, i) => (
              <div
                key={`b-${i}`}
                className="ob-row"
                style={b.isWall ? { background: "rgba(0,230,118,0.06)", borderRadius: 4 } : undefined}
              >
                <div className="ob-price" style={{ color: "var(--green)" }}>
                  {fmtPrice(b.price)}
                </div>
                <div className="ob-bar-wrap">
                  <div className="ob-bar bid" style={{ width: `${b.barPct}%` }} />
                </div>
                <div className="ob-size" style={{ color: b.isWall ? "var(--green)" : undefined }}>
                  {fmt(b.size, 2)}
                  {b.isWall ? " 🧱" : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="ob-spread">
          价差 {fmtPrice(book.spread)} ({book.spreadPct}%)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "var(--ctbox-text-2xs)", fontFamily: "var(--mono)", marginBottom: 8 }}>
          <div>
            2% 买深 <span style={{ color: "var(--green)" }}>${fmt(book.bidDepth2Usd)}</span>
          </div>
          <div>
            2% 卖深 <span style={{ color: "var(--red)" }}>${fmt(book.askDepth2Usd)}</span>
          </div>
          <div>
            深度比{" "}
            <span style={{ color: book.depthRatioColor }}>
              {book.depthRatio != null ? book.depthRatio.toFixed(2) : "--"}
            </span>{" "}
            ({book.depthRatioNote})
          </div>
          <div>大单墙约 {book.wallCount} 处</div>
        </div>
        <div style={{ fontSize: "var(--ctbox-text-xs)", color: "var(--text-dim)", lineHeight: 1.65 }}>{book.liquidityHtml}</div>
      </div>
    </div>
  );
}
