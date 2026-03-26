"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "@/lib/api";

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

export default function AnalysisPage() {
  const [base, setBase] = useState("BTC");
  const [interval, setInterval] = useState("1h");
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [closes, setCloses] = useState<number[]>([]);
  const [err, setErr] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const symbol = useMemo(() => `${base.toUpperCase()}USDT`, [base]);

  async function load() {
    setErr("");
    const [t, k] = await Promise.all([
      fetchJson<Ticker>(`/api/ticker?symbol=${encodeURIComponent(symbol)}`),
      fetchJson<(number | string)[][]>(
        `/api/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=60`
      ),
    ]);
    setTicker(t);
    setCloses(k.map((row) => parseFloat(String(row[4]))).filter((n) => Number.isFinite(n)));
  }

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval]);

  useEffect(() => {
    drawMiniChart(canvasRef.current, closes);
  }, [closes]);

  const last = ticker ? parseFloat(ticker.lastPrice) : 0;
  const chgPct = ticker ? parseFloat(ticker.priceChangePercent) : 0;
  const isUp = chgPct >= 0;

  return (
    <main style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="section-label">分析（React 迁移版 · 第一阶段）</div>

      <div className="panel">
        <div className="panel-header" style={{ gap: 8, flexWrap: "wrap" }}>
          <div className="panel-title">行情概览</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={base}
              onChange={(e) => setBase(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 10))}
              placeholder="如 BTC"
              style={{
                background: "var(--bg3)",
                border: "1px solid var(--border2)",
                color: "var(--text)",
                fontFamily: "var(--mono)",
                fontSize: 13,
                padding: "6px 10px",
                borderRadius: "var(--r)",
                outline: "none",
                width: 110,
              }}
            />
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              style={{
                background: "var(--bg3)",
                border: "1px solid var(--border2)",
                color: "var(--text)",
                fontFamily: "var(--mono)",
                fontSize: 13,
                padding: "6px 10px",
                borderRadius: "var(--r)",
                outline: "none",
              }}
            >
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1d">1d</option>
            </select>
            <button className="btn secondary" onClick={() => load().catch(() => {})} style={{ padding: "6px 10px" }}>
              刷新
            </button>
          </div>
        </div>

        <div className="panel-body">
          {err ? (
            <div style={{ color: "var(--red)", fontSize: 12, lineHeight: 1.6 }}>{err}</div>
          ) : (
            <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
              <div style={{ minWidth: 240 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-muted)" }}>
                  {base.toUpperCase()}/USDT
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 800, color: isUp ? "var(--green)" : "var(--red)" }}>
                  {last ? `$${fmtPrice(last)}` : "--"}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: isUp ? "var(--green)" : "var(--red)" }}>
                  {ticker ? `${isUp ? "+" : ""}${chgPct.toFixed(2)}%` : "--"}
                </div>
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="futures-card">
                    <div className="futures-card-label">24H HIGH</div>
                    <div className="futures-card-value">{ticker ? `$${fmtPrice(parseFloat(ticker.highPrice))}` : "--"}</div>
                  </div>
                  <div className="futures-card">
                    <div className="futures-card-label">24H LOW</div>
                    <div className="futures-card-value">{ticker ? `$${fmtPrice(parseFloat(ticker.lowPrice))}` : "--"}</div>
                  </div>
                  <div className="futures-card">
                    <div className="futures-card-label">24H VOL</div>
                    <div className="futures-card-value">{ticker ? `$${fmt(parseFloat(ticker.quoteVolume))}` : "--"}</div>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 260, display: "flex", alignItems: "center" }}>
                <canvas ref={canvasRef} width={200} height={60} style={{ width: "100%", height: 70, borderRadius: 10, background: "var(--bg2)" }} />
              </div>
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            下一阶段会把“综合评分、情绪标签、资金费率/OI/多空比、订单簿、指标信号”等模块逐块迁移成 React 组件，并把原 `js/analysis.js` 的主流程改为可测试的纯数据流。
          </div>
        </div>
      </div>
    </main>
  );
}

