"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/api";
import { USDT_BASE_OPTIONS } from "@/lib/usdtBaseOptions";

type Dir = "long" | "short";
type Mode = "cross" | "isolated";

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

function calcCore(params: {
  dir: Dir;
  mode: Mode;
  balance: number;
  margin: number;
  lev: number;
  entry: number;
}) {
  const { dir, mode, balance, margin, lev, entry } = params;
  if (!margin || !lev || !entry) return null;

  const posValue = margin * lev;
  const posCoins = posValue / entry;
  const isCross = mode === "cross";
  const isLong = dir === "long";
  const mmr = 0.005;

  let liqPrice: number;
  if (isCross && balance > 0) {
    const totalMargin = balance;
    liqPrice = isLong
      ? entry - totalMargin / posCoins + entry * mmr
      : entry + totalMargin / posCoins - entry * mmr;
  } else {
    liqPrice = isLong
      ? entry * (1 - 1 / lev + mmr)
      : entry * (1 + 1 / lev - mmr);
  }
  liqPrice = Math.max(0, liqPrice);

  const liqDist = Math.abs(entry - liqPrice);
  const liqDistPct = (liqDist / entry) * 100;
  const realLev = isCross && balance > 0 ? posValue / balance : lev;
  const marginRatioPct = isCross && balance > 0 ? (margin / balance) * 100 : null;
  const maxLoss = isCross ? balance : margin;
  const maxLossPct = isCross && balance > 0 ? (maxLoss / balance) * 100 : 100;

  const risk = (() => {
    if (lev >= 50 || liqDistPct < 5) return { level: "极高风险", color: "var(--red)" };
    if (lev >= 20 || liqDistPct < 10) return { level: "高风险", color: "#ff9800" };
    if (lev >= 10 || liqDistPct < 20) return { level: "中等风险", color: "var(--gold)" };
    return { level: "低风险", color: "var(--green)" };
  })();

  return {
    posValue,
    posCoins,
    liqPrice,
    liqDistPct,
    realLev,
    marginRatioPct,
    maxLoss,
    maxLossPct,
    risk,
  };
}

export default function CalcPage() {
  const [coin, setCoin] = useState("BTC");
  const [dir, setDir] = useState<Dir>("long");
  const [mode, setMode] = useState<Mode>("cross");
  const [balance, setBalance] = useState(1000);
  const [margin, setMargin] = useState(100);
  const [lev, setLev] = useState(10);
  const [entry, setEntry] = useState<number>(0);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const symbol = `${coin.toUpperCase()}USDT`;

  useEffect(() => {
    setEntry((v) => (v > 0 ? v : currentPrice));
  }, [currentPrice]);

  async function refreshPrice() {
    const t = await fetchJson<{ lastPrice: string }>(`/api/ticker?symbol=${encodeURIComponent(symbol)}`);
    const p = parseFloat(t.lastPrice);
    if (Number.isFinite(p) && p > 0) setCurrentPrice(p);
    if (!entry) setEntry(p);
  }

  useEffect(() => {
    refreshPrice().catch(() => {});
    const timer = setInterval(() => refreshPrice().catch(() => {}), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const result = useMemo(
    () => calcCore({ dir, mode, balance, margin, lev, entry: entry || currentPrice }),
    [dir, mode, balance, margin, lev, entry, currentPrice]
  );

  return (
    <main style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="section-label">合约计算器</div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">开仓参数</div>
          <span className="panel-badge badge-blue">
            当前价: {currentPrice ? `$${fmtPrice(currentPrice)}` : "--"}
          </span>
        </div>
        <div className="panel-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div className="calc-label">币种</div>
              <select
                className="form-select input-monospace input-block"
                value={coin}
                onChange={(e) => setCoin(e.target.value)}
                aria-label="币种（USDT 本位）"
              >
                {USDT_BASE_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="calc-label">方向</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <button className={`calc-dir-btn bull ${dir === "long" ? "active" : ""}`} onClick={() => setDir("long")}>
                  ▲ 做多
                </button>
                <button className={`calc-dir-btn bear ${dir === "short" ? "active" : ""}`} onClick={() => setDir("short")}>
                  ▼ 做空
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="calc-label">保证金模式</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className={`calc-mode-btn ${mode === "cross" ? "active" : ""}`} onClick={() => setMode("cross")}>
                全仓
              </button>
              <button className={`calc-mode-btn ${mode === "isolated" ? "active" : ""}`} onClick={() => setMode("isolated")}>
                逐仓
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="calc-label">账户余额 (USDT)</div>
            <input
              className="form-control input-monospace input-block"
              type="number"
              value={balance}
              min={0}
              onChange={(e) => setBalance(parseFloat(e.target.value || "0"))}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="calc-label">下单保证金 (USDT)</div>
            <input
              className="form-control input-monospace input-block"
              type="number"
              value={margin}
              min={0}
              onChange={(e) => setMargin(parseFloat(e.target.value || "0"))}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="calc-label" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>杠杆倍数</span>
              <span style={{ color: "var(--fgColor-accent, var(--blue))", fontFamily: "var(--mono)", fontWeight: 700 }}>{lev}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={125}
              value={lev}
              onChange={(e) => setLev(parseInt(e.target.value, 10))}
              style={{ width: "100%", accentColor: "var(--fgColor-accent, var(--blue))", margin: "6px 0" }}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="calc-label">开仓价格 (USDT)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="form-control input-monospace"
                type="number"
                value={entry || ""}
                placeholder={currentPrice ? String(currentPrice) : "输入开仓价"}
                step="any"
                onChange={(e) => setEntry(parseFloat(e.target.value || "0"))}
                style={{ flex: 1, minWidth: 0 }}
              />
              <button type="button" className="btn secondary" onClick={() => setEntry(currentPrice)} style={{ fontSize: "var(--ctbox-text-sm)", padding: "6px 12px", whiteSpace: "nowrap", fontWeight: 700 }}>
                当前价
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">计算结果</div>
          <span className="panel-badge" style={{ color: result?.risk.color }}>
            {result?.risk.level || "--"}
          </span>
        </div>
        <div className="panel-body">
          <div className="futures-grid" style={{ marginBottom: 14 }}>
            <div className="futures-card">
              <div className="futures-card-label">爆仓价</div>
              <div className="futures-card-value" style={{ color: "var(--red)" }}>
                {result ? `$${fmtPrice(result.liqPrice)}` : "--"}
              </div>
              <div className="futures-card-sub">
                {result ? `距爆仓 ${result.liqDistPct.toFixed(2)}%` : "--"}
              </div>
            </div>
            <div className="futures-card">
              <div className="futures-card-label">仓位价值</div>
              <div className="futures-card-value">{result ? `$${fmt(result.posValue)}` : "--"}</div>
              <div className="futures-card-sub">{result ? `${result.posCoins.toFixed(4)} ${coin.toUpperCase()}` : "--"}</div>
            </div>
            <div className="futures-card">
              <div className="futures-card-label">实际杠杆</div>
              <div className="futures-card-value">{result ? `${result.realLev.toFixed(1)}x` : "--"}</div>
              <div className="futures-card-sub">
                {result?.marginRatioPct != null ? `占余额 ${result.marginRatioPct.toFixed(1)}%` : "保证金模式"}
              </div>
            </div>
            <div className="futures-card">
              <div className="futures-card-label">最大亏损</div>
              <div className="futures-card-value" style={{ color: "var(--red)" }}>
                {result ? `-$${fmt(result.maxLoss)}` : "--"}
              </div>
              <div className="futures-card-sub">{result ? `亏损 ${result.maxLossPct.toFixed(1)}%` : "--"}</div>
            </div>
          </div>

          <div style={{ fontSize: "var(--ctbox-text-xs)", color: "var(--text-muted)", lineHeight: 1.6 }}>
            说明：结果为简化模型估算，未包含手续费、资金费率与维持保证金阶梯等细节，仅供参考，不构成投资建议。
          </div>
        </div>
      </div>
    </main>
  );
}

