"use client";

import { Button, SegmentedControl } from "@primer/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "@/lib/api";
import { fmt, fmtPrice } from "@/lib/eventFormat";
import { durationToKlineInterval } from "@/lib/eventHelpers";
import {
  loadAccount,
  loadHistory,
  loadOrders,
  resetEventStorage,
  saveAccount,
  saveHistory,
  saveOrders,
  type EvAccount,
  type EvHistoryOrder,
  type EvOrder,
} from "@/lib/eventStorage";
import { calcEventSuggestion, type EventSuggestionResult } from "@/lib/eventSuggestion";

type Ticker = {
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  quoteVolume: string;
};

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

const DURATIONS = [10, 30, 60, 1440] as const;

function durationLabel(mins: number) {
  if (mins >= 1440) return "1天";
  if (mins >= 60) return "1小时";
  return `${mins}分钟`;
}

export default function EventPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const suggestionMetaRef = useRef<EventSuggestionResult | null>(null);

  const [coin, setCoin] = useState<"BTC" | "ETH">("BTC");
  const [duration, setDuration] = useState<number>(10);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [klines, setKlines] = useState<(string | number)[][] | null>(null);
  const [suggestion, setSuggestion] = useState<EventSuggestionResult | null>(null);
  const [account, setAccount] = useState<EvAccount>(() => ({
    balance: 1000,
    totalPnl: 0,
    wins: 0,
    losses: 0,
    followWins: 0,
    followLosses: 0,
  }));
  const [orders, setOrders] = useState<EvOrder[]>([]);
  const [history, setHistory] = useState<EvHistoryOrder[]>([]);
  const [amount, setAmount] = useState(10);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [, setNowTick] = useState(0);

  useEffect(() => {
    setAccount(loadAccount());
    setOrders(loadOrders());
    setHistory(loadHistory());
    setHydrated(true);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const loadMarket = useCallback(
    async (recalc: boolean) => {
      setLoadError(null);
      const symbol = `${coin}USDT`;
      const interval = durationToKlineInterval(duration);
      try {
        const [t, k] = await Promise.all([
          fetchJson<Ticker>(`/api/ticker?symbol=${encodeURIComponent(symbol)}`),
          fetchJson<(string | number)[][]>(
            `/api/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=100`
          ),
        ]);
        setTicker(t);
        setKlines(k);
        if (recalc) {
          const sug = calcEventSuggestion(k, duration);
          setSuggestion(sug);
          suggestionMetaRef.current = sug;
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    },
    [coin, duration]
  );

  useEffect(() => {
    if (!hydrated) return;
    loadMarket(true).catch(() => {});
  }, [hydrated, loadMarket]);

  const tickerRef = useRef<Ticker | null>(null);
  useEffect(() => {
    tickerRef.current = ticker;
  }, [ticker]);

  useEffect(() => {
    if (!klines?.length) return;
    const closes = klines.map((row) => parseFloat(String(row[4]))).filter((n) => Number.isFinite(n));
    drawMiniChart(canvasRef.current, closes.slice(-60));
  }, [klines]);

  const settleOnce = useCallback(async () => {
    const list = loadOrders();
    if (list.length === 0) return;

    const now = Date.now();
    const hasExpired = list.some((o) => now >= o.expireAt);
    if (!hasExpired) return;

    const acc = loadAccount();
    const hist = loadHistory();
    const remaining: EvOrder[] = [];
    const priceMap: Record<string, number> = {};
    const tk = tickerRef.current;
    if (tk) {
      priceMap[coin] = parseFloat(tk.lastPrice);
    }

    for (const order of list) {
      if (now < order.expireAt) {
        remaining.push(order);
        continue;
      }

      let exitPrice = priceMap[order.coin];
      if (exitPrice == null || !Number.isFinite(exitPrice)) {
        try {
          const t = await fetchJson<Ticker>(`/api/ticker?symbol=${encodeURIComponent(order.coin + "USDT")}`);
          exitPrice = parseFloat(t.lastPrice);
          priceMap[order.coin] = exitPrice;
        } catch {
          remaining.push(order);
          continue;
        }
      }

      const priceUp = exitPrice > order.entryPrice;
      const won = (order.direction === "up" && priceUp) || (order.direction === "down" && !priceUp);
      const pnl = won ? parseFloat((order.amount * 0.8).toFixed(2)) : -order.amount;

      acc.balance = parseFloat((acc.balance + (won ? order.amount + pnl : 0)).toFixed(2));
      acc.totalPnl = parseFloat((acc.totalPnl + pnl).toFixed(2));
      if (won) acc.wins++;
      else acc.losses++;
      if (order.followSuggestion) {
        if (won) acc.followWins++;
        else acc.followLosses++;
      }

      hist.unshift({
        ...order,
        exitPrice,
        won,
        pnl,
        settledAt: now,
      });

      const dirText = order.direction === "up" ? "▲买涨" : "▼买跌";
      const result = won ? `✅ +${pnl} USDT` : `❌ -${order.amount} USDT`;
      showToast(`${order.coin} ${dirText} 已结算 ${result}`);
    }

    saveAccount(acc);
    saveHistory(hist);
    saveOrders(remaining);
    setAccount(loadAccount());
    setOrders(loadOrders());
    setHistory(loadHistory());
  }, [coin, showToast]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick((n) => n + 1);
      settleOnce().catch(() => {});
    }, 1000);
    return () => clearInterval(id);
  }, [settleOnce]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const symbol = `${coin}USDT`;
      fetchJson<Ticker>(`/api/ticker?symbol=${encodeURIComponent(symbol)}`)
        .then((t) => {
          setTicker(t);
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [coin]);

  const lastPrice = ticker ? parseFloat(ticker.lastPrice) : 0;
  const changePct = ticker ? parseFloat(ticker.priceChangePercent) : 0;
  const isUp = changePct >= 0;

  const winPreview = useMemo(() => (amount * 1.8).toFixed(2), [amount]);

  async function onRefreshAnalysis() {
    setRefreshing(true);
    try {
      await loadMarket(true);
    } finally {
      setRefreshing(false);
    }
  }

  function placeOrder(direction: "up" | "down") {
    if (!ticker) {
      window.alert("行情数据未加载，请稍后");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("请输入有效金额");
      return;
    }

    const acc = loadAccount();
    if (amount > acc.balance) {
      window.alert(`余额不足，当前余额 ${acc.balance.toFixed(2)} USDT`);
      return;
    }

    const dirText = direction === "up" ? "▲ 买涨" : "▼ 买跌";
    const timeText = durationLabel(duration);
    const priceStr = fmtPrice(parseFloat(ticker.lastPrice));
    const win = (amount * 1.8).toFixed(2);
    const meta = suggestionMetaRef.current;
    let sugLine = "";
    if (meta?.ok) {
      const d = meta.meta.direction;
      const match =
        (direction === "up" && d === "up") || (direction === "down" && d === "down");
      const neutral = d === "neutral";
      sugLine = neutral ? "" : match ? "\n\n✅ 与系统建议一致" : "\n\n⚠️ 与系统建议相反";
    }

    if (
      !window.confirm(
        `确认下单？\n\n` +
          `币种：${coin}/USDT\n` +
          `方向：${dirText}\n` +
          `时间：${timeText}\n` +
          `入场价：$${priceStr}\n` +
          `金额：${amount} USDT\n` +
          `猜对得：${win} USDT` +
          sugLine
      )
    ) {
      return;
    }

    const entryPrice = parseFloat(ticker.lastPrice);
    const expireAt = Date.now() + duration * 60 * 1000;
    const suggestionSnap = suggestionMetaRef.current;
    const sugDir =
      suggestionSnap?.ok === true ? suggestionSnap.meta.direction : ("neutral" as const);
    const followSug =
      suggestionSnap?.ok === true &&
      ((direction === "up" && sugDir === "up") || (direction === "down" && sugDir === "down"));

    const order: EvOrder = {
      id: Date.now(),
      coin,
      direction,
      amount,
      entryPrice,
      duration,
      expireAt,
      followSuggestion: !!followSug,
      suggestionDir: sugDir,
    };

    acc.balance = parseFloat((acc.balance - amount).toFixed(2));
    saveAccount(acc);

    const next = [...loadOrders(), order];
    saveOrders(next);

    setAccount(loadAccount());
    setOrders(loadOrders());
    showToast(`已下单 ${dirText} ${coin} · ${amount} USDT · ${timeText}后结算`);
  }

  function onResetAccount() {
    if (!window.confirm("确认重置账户？所有数据将清空，余额恢复1000 USDT")) return;
    resetEventStorage();
    setAccount(loadAccount());
    setOrders(loadOrders());
    setHistory(loadHistory());
    showToast("账户已重置，余额恢复 1000 USDT");
  }

  const totalTrades = account.wins + account.losses;
  const winRate = totalTrades > 0 ? `${((account.wins / totalTrades) * 100).toFixed(1)}%` : "--";
  const followTotal = account.followWins + account.followLosses;
  const followRate = followTotal > 0 ? `${((account.followWins / followTotal) * 100).toFixed(1)}%` : "--";

  return (
    <main style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="section-label">事件合约</div>

      {loadError ? (
        <div style={{ color: "var(--red)", fontSize: "var(--ctbox-text-xs)", lineHeight: 1.6 }}>{loadError}</div>
      ) : null}

      <div className="panel" id="evPriceHero">
        <div className="panel-header" style={{ gap: 8, flexWrap: "wrap" }}>
          <div className="panel-title">行情概览</div>
          <div style={{ marginLeft: "auto" }}>
            <SegmentedControl aria-label="合约标的" size="small" onChange={(i) => setCoin(i === 0 ? "BTC" : "ETH")}>
              <SegmentedControl.Button selected={coin === "BTC"}>BTC</SegmentedControl.Button>
              <SegmentedControl.Button selected={coin === "ETH"}>ETH</SegmentedControl.Button>
            </SegmentedControl>
          </div>
        </div>
        <div className="panel-body">
          <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
            <div style={{ minWidth: 240 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-xs)", color: "var(--text-muted)" }}>
                {coin}/USDT
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "var(--ctbox-text-display-sm)",
                  fontWeight: 800,
                  color: lastPrice ? (isUp ? "var(--green)" : "var(--red)") : "var(--text-muted)",
                }}
              >
                {lastPrice ? `$${fmtPrice(lastPrice)}` : "--"}
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-xs)", color: isUp ? "var(--green)" : "var(--red)" }}>
                {ticker ? `${isUp ? "+" : ""}${changePct.toFixed(2)}% ${isUp ? "▲" : "▼"}` : "--"}
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

      <div className="panel" id="evSuggestionPanel">
        <div className="panel-header">
          <div className="panel-title">系统方向建议</div>
          <span
            className={`panel-badge ${
              suggestion?.ok ? suggestion.badgeClass : "badge-amber"
            }`}
          >
            {suggestion?.ok ? suggestion.badgeText : "分析中"}
          </span>
          <Button
            variant="invisible"
            size="small"
            id="evRefreshBtn"
            disabled={refreshing}
            onClick={() => onRefreshAnalysis()}
            title="重新分析"
            style={{ marginLeft: "auto", fontFamily: "var(--mono)" }}
          >
            {refreshing ? "⟳ 分析中..." : "⟳ 刷新分析"}
          </Button>
        </div>
        <div className="panel-body">
          <div style={{ marginBottom: 16 }}>
            <SegmentedControl
              aria-label="事件时长"
              size="small"
              onChange={(i) => setDuration(DURATIONS[i]!)}
            >
              {DURATIONS.map((m) => (
                <SegmentedControl.Button key={m} selected={duration === m}>
                  {durationLabel(m)}
                </SegmentedControl.Button>
              ))}
            </SegmentedControl>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: 16,
              background: "var(--bg2)",
              borderRadius: "var(--r-lg)",
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div
                style={{
                  fontSize: "var(--ctbox-text-2xs)",
                  color: "var(--text-muted)",
                  fontFamily: "var(--mono)",
                  marginBottom: 6,
                  letterSpacing: 1,
                }}
              >
                方向建议
              </div>
              <div
                style={{
                  fontSize: "var(--ctbox-text-display-sm)",
                  fontWeight: 700,
                  fontFamily: "var(--mono)",
                  color: suggestion?.ok ? suggestion.directionColor : "var(--text-muted)",
                }}
              >
                {suggestion?.ok ? suggestion.directionLabel : suggestion?.ok === false ? suggestion.reason : "--"}
              </div>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div
                style={{
                  fontSize: "var(--ctbox-text-2xs)",
                  color: "var(--text-muted)",
                  fontFamily: "var(--mono)",
                  marginBottom: 6,
                  letterSpacing: 1,
                }}
              >
                置信度
              </div>
              <div
                style={{
                  fontSize: "var(--ctbox-text-xl)",
                  fontWeight: 700,
                  fontFamily: "var(--mono)",
                  color: suggestion?.ok ? suggestion.confidenceColor : "var(--text-muted)",
                }}
              >
                {suggestion?.ok ? suggestion.confidenceLabel : "--"}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div
                style={{
                  fontSize: "var(--ctbox-text-2xs)",
                  color: "var(--text-muted)",
                  fontFamily: "var(--mono)",
                  marginBottom: 6,
                  letterSpacing: 1,
                }}
              >
                核心依据
              </div>
              <div style={{ fontSize: "var(--ctbox-text-xs)", color: "var(--text-dim)", lineHeight: 1.8 }}>
                {suggestion?.ok ? suggestion.reasonsText : "--"}
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: "var(--ctbox-text-2xs)",
              color: "var(--text-muted)",
              padding: "8px 12px",
              background: "rgba(240,185,11,0.06)",
              border: "1px solid rgba(240,185,11,0.15)",
              borderRadius: "var(--r)",
              lineHeight: 1.6,
            }}
          >
            ⚠ 本建议基于技术分析，仅供参考。市场存在不确定性，请理性参与模拟交易。
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">模拟下单</div>
          <span style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-xs)", color: "var(--gold)" }}>
            余额：
            <span
              style={{
                color:
                  account.balance >= 1000 ? "var(--gold)" : account.balance >= 500 ? "var(--green)" : "var(--red)",
              }}
            >
              {account.balance.toFixed(2)}
            </span>{" "}
            USDT
          </span>
        </div>
        <div className="panel-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div
                style={{
                  fontSize: "var(--ctbox-text-2xs)",
                  color: "var(--text-muted)",
                  fontFamily: "var(--mono)",
                  marginBottom: 8,
                  letterSpacing: 1,
                }}
              >
                下单金额 (USDT)
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="form-control input-monospace"
                  type="number"
                  value={amount}
                  min={1}
                  max={10000}
                  onChange={(e) => setAmount(parseFloat(e.target.value || "0"))}
                  style={{ width: 120, fontSize: "var(--ctbox-text-lg)" }}
                />
                {[10, 50, 100, 500].map((v) => (
                  <Button key={v} type="button" variant="default" size="small" onClick={() => setAmount(v)}>
                    {v}
                  </Button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: "var(--ctbox-text-xs)", color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
              猜对赔率 <span style={{ color: "var(--green)", fontWeight: 700 }}>+80%</span> · 下单{" "}
              <span style={{ color: "var(--gold)" }}>{amount}</span> USDT · 猜对得{" "}
              <span style={{ color: "var(--green)" }}>{winPreview}</span> USDT
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Button
                type="button"
                variant="default"
                block
                className="ctbox-ev-order-bull"
                onClick={() => placeOrder("up")}
              >
                <span style={{ fontSize: "var(--ctbox-text-xl)" }}>▲</span>
                <span>买涨</span>
                <span style={{ fontSize: "var(--ctbox-text-2xs)", opacity: 0.8 }}>{coin} 涨</span>
              </Button>
              <Button
                type="button"
                variant="danger"
                block
                className="ctbox-ev-order-bear"
                onClick={() => placeOrder("down")}
              >
                <span style={{ fontSize: "var(--ctbox-text-xl)" }}>▼</span>
                <span>买跌</span>
                <span style={{ fontSize: "var(--ctbox-text-2xs)", opacity: 0.8 }}>{coin} 跌</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" id="evActivePanel">
        <div className="panel-header">
          <div className="panel-title">当前持仓</div>
          <span className="panel-badge badge-blue">{orders.length}笔</span>
        </div>
        <div className="panel-body">
          {orders.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: "var(--ctbox-text-sm)" }}>
              暂无持仓
            </div>
          ) : (
            orders.map((order) => {
              const remaining = Math.max(0, order.expireAt - Date.now());
              const mins = Math.floor(remaining / 60000);
              const secs = Math.floor((remaining % 60000) / 1000);
              const countdown =
                remaining > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : "结算中...";
              const dirColor = order.direction === "up" ? "var(--green)" : "var(--red)";
              const dirText = order.direction === "up" ? "▲ 买涨" : "▼ 买跌";
              const timeText =
                order.duration >= 1440 ? "1天" : order.duration >= 60 ? "1小时" : `${order.duration}分`;
              return (
                <div key={order.id} className="ev-position-row">
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-sm)", fontWeight: 700, color: dirColor }}>
                        {dirText}
                      </span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)" }}>
                        {order.coin}USDT
                      </span>
                      {order.followSuggestion ? (
                        <span
                          style={{
                            fontSize: "var(--ctbox-text-2xs)",
                            background: "rgba(240,185,11,0.15)",
                            color: "var(--gold)",
                            border: "1px solid rgba(240,185,11,0.3)",
                            padding: "1px 6px",
                            borderRadius: 10,
                            marginLeft: 4,
                          }}
                        >
                          跟随建议
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
                      入场 ${fmtPrice(order.entryPrice)} · {order.amount} USDT · {timeText}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-lg)", fontWeight: 700, color: "var(--gold)" }}>
                      {countdown}
                    </div>
                    <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)" }}>剩余时间</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">账户统计</div>
        </div>
        <div className="panel-body">
          <div className="futures-grid" style={{ marginBottom: 14 }}>
            <div className="futures-card">
              <div className="futures-card-label">总盈亏</div>
              <div
                className="futures-card-value"
                style={{ color: account.totalPnl >= 0 ? "var(--green)" : "var(--red)" }}
              >
                {(account.totalPnl >= 0 ? "+" : "") + account.totalPnl.toFixed(2)}
              </div>
            </div>
            <div className="futures-card">
              <div className="futures-card-label">总胜率</div>
              <div className="futures-card-value">{winRate}</div>
            </div>
            <div className="futures-card">
              <div className="futures-card-label">跟随建议胜率</div>
              <div className="futures-card-value">{followRate}</div>
            </div>
            <div className="futures-card">
              <div className="futures-card-label">总交易次数</div>
              <div className="futures-card-value">{totalTrades}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onResetAccount}
            style={{
              fontSize: "var(--ctbox-text-2xs)",
              color: "var(--text-muted)",
              background: "none",
              border: "1px solid var(--border2)",
              padding: "5px 12px",
              borderRadius: "var(--r)",
              cursor: "pointer",
              fontFamily: "var(--mono)",
            }}
          >
            重置账户
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">历史订单</div>
          <span className="panel-badge badge-blue">{history.length}笔</span>
        </div>
        <div className="panel-body">
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: "var(--ctbox-text-sm)" }}>
              暂无历史
            </div>
          ) : (
            history.slice(0, 20).map((order) => {
              const dirText = order.direction === "up" ? "▲涨" : "▼跌";
              const dirColor = order.direction === "up" ? "var(--green)" : "var(--red)";
              const pnlColor = order.won ? "var(--green)" : "var(--red)";
              const pnlText = order.won ? `+${order.pnl.toFixed(2)}` : order.pnl.toFixed(2);
              const timeStr = new Date(order.settledAt).toLocaleString("zh-CN", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div key={order.id + order.settledAt} className="ev-hist-row">
                  <span style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-2xs)", fontWeight: 700, color: dirColor }}>
                    {dirText}
                  </span>
                  <div>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-2xs)", color: "var(--text-dim)" }}>
                      {order.coin} {order.amount}U {order.followSuggestion ? <span style={{ color: "var(--gold)" }}>★</span> : null}
                    </span>
                    <span className="ev-hist-time" style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", marginLeft: 6 }}>
                      {timeStr}
                    </span>
                  </div>
                  <span className="ev-hist-entry" style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)" }}>
                    ${fmtPrice(order.entryPrice)}→${fmtPrice(order.exitPrice)}
                  </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-xs)", fontWeight: 700, color: pnlColor }}>
                    {pnlText}
                  </span>
                  <span style={{ fontSize: "var(--ctbox-text-2xs)" }}>{order.won ? "✅" : "❌"}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {toast ? (
        <div
          style={{
            position: "fixed",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg2)",
            border: "1px solid var(--border2)",
            color: "var(--text)",
            fontSize: "var(--ctbox-text-sm)",
            padding: "10px 20px",
            borderRadius: "var(--r-lg)",
            zIndex: 9998,
            fontFamily: "var(--mono)",
            whiteSpace: "nowrap",
            boxShadow: "var(--shadow)",
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      ) : null}
    </main>
  );
}
