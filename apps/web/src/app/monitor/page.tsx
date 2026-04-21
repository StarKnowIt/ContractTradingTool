"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api";
import {
  fetchProxyJson,
  BinanceFuturesExchangeInfo,
  BinanceFuturesPremiumIndexRaw,
  BinanceFuturesTicker24hRaw,
  BinanceForceOrderRaw,
  BinanceLongShortRatioRaw,
  BinanceOpenInterestHistRaw,
} from "@/lib/monitorApi";
import { computeHorseSignals, sortPriceList, type PriceRow } from "@/lib/monitorLogic";
import {
  DEFAULT_MONITOR_SETTINGS,
  loadMonitorSettings,
  saveMonitorSettings,
  type MonitorSettings,
} from "@/lib/monitorSettings";
import { qk } from "@/lib/queryKeys";

const LIQ_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT"] as const;
const OI_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT", "MATICUSDT", "LTCUSDT"] as const;
const LS_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"] as const;

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

function isOkArray<T>(x: unknown): x is T[] {
  return Array.isArray(x);
}

function parseNum(x: unknown) {
  const n = typeof x === "number" ? x : parseFloat(String(x));
  return Number.isFinite(n) ? n : NaN;
}

function errMsg(e: unknown) {
  if (!e) return "";
  if (e instanceof Error) return e.message;
  return String(e);
}

function isFapiTimeout(e: unknown) {
  const m = errMsg(e);
  return m.includes("fapi.binance.com") && m.includes("timeout");
}

export default function MonitorPage() {
  const [priceMode, setPriceMode] = useState<"up" | "down" | "vol">("up");
  // 首屏必须与 SSR 一致：服务端无 localStorage，故先默认再于 effect 中同步，避免 hydration mismatch
  const [settings, setSettings] = useState<MonitorSettings>(DEFAULT_MONITOR_SETTINGS);

  useEffect(() => {
    startTransition(() => {
      setSettings(loadMonitorSettings());
    });
  }, []);

  function patchSettings(patch: Partial<MonitorSettings>) {
    setSettings((s) => {
      const n = { ...s, ...patch };
      saveMonitorSettings(n);
      return n;
    });
  }

  const pollMs = settings.refreshSec > 0 ? settings.refreshSec * 1000 : false;

  const validSymbolsQ = useQuery({
    queryKey: qk.validSymbols(),
    queryFn: async () => {
      const data = await fetchProxyJson<BinanceFuturesExchangeInfo>("https://fapi.binance.com/fapi/v1/exchangeInfo");
      const symbols =
        (data.symbols || [])
          .filter((s) => s.status === "TRADING" && s.contractType === "PERPETUAL" && s.quoteAsset === "USDT")
          .map((s) => s.symbol) || [];
      return symbols.length > 50 ? new Set(symbols) : new Set<string>();
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const priceQ = useQuery({
    queryKey: [...qk.ticker24hr(), validSymbolsQ.dataUpdatedAt ?? 0] as const,
    enabled: validSymbolsQ.isFetched,
    queryFn: async () => {
      const raw = await fetchProxyJson<unknown>("https://fapi.binance.com/fapi/v1/ticker/24hr");
      if (!isOkArray<BinanceFuturesTicker24hRaw>(raw)) return [] as PriceRow[];

      // exchangeInfo 失败时 data 为空：与 legacy 一致，不做合约白名单过滤
      const allow = validSymbolsQ.data ?? new Set<string>();
      return raw
        .filter((t) => {
          if (!t.symbol?.endsWith("USDT")) return false;
          if (t.symbol.includes("_")) return false;
          if (allow.size && !allow.has(t.symbol)) return false;
          const vol = parseNum(t.quoteVolume);
          const price = parseNum(t.lastPrice);
          if (!(vol >= 20_000_000)) return false;
          if (!(price > 0)) return false;
          const count = parseInt(String(t.count || 0), 10);
          if (!(count >= 1000)) return false;
          return true;
        })
        .map((t) => ({
          symbol: t.symbol.replace("USDT", ""),
          price: parseNum(t.lastPrice),
          change: parseNum(t.priceChangePercent),
          volume: parseNum(t.quoteVolume),
          high: parseNum(t.highPrice),
          low: parseNum(t.lowPrice),
        }))
        .filter((t) => Number.isFinite(t.price) && Number.isFinite(t.change) && Number.isFinite(t.volume))
        .sort((a, b) => b.volume - a.volume);
    },
    refetchInterval: pollMs,
    staleTime: 30_000,
    retry: 1,
  });

  const horses = useMemo(
    () => computeHorseSignals(priceQ.data || [], { topHorse: settings.topHorse }),
    [priceQ.data, settings.topHorse]
  );

  const fundingQ = useQuery({
    queryKey: qk.premiumIndex(),
    queryFn: async () => {
      const raw = await fetchProxyJson<unknown>("https://fapi.binance.com/fapi/v1/premiumIndex");
      if (!isOkArray<BinanceFuturesPremiumIndexRaw>(raw)) return [];
      const allow = validSymbolsQ.data ?? new Set<string>();
      return raw
        .filter((d) => d.symbol?.endsWith("USDT") && !d.symbol.includes("_") && (!allow.size || allow.has(d.symbol)))
        .map((d) => ({
          symbol: d.symbol.replace("USDT", ""),
          rate: parseNum(d.lastFundingRate) * 100,
          price: parseNum(d.markPrice),
        }))
        .filter((d) => Number.isFinite(d.rate))
        .sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate))
        .slice(0, 30);
    },
    refetchInterval: pollMs,
    staleTime: 30_000,
    retry: 1,
  });

  const fundingDisplay = useMemo(
    () => (fundingQ.data || []).slice(0, settings.topFunding),
    [fundingQ.data, settings.topFunding]
  );

  const liqQueries = useQueries({
    queries: LIQ_SYMBOLS.map((s) => ({
      queryKey: qk.forceOrders(s),
      queryFn: async () => await fetchJson<BinanceForceOrderRaw[]>(`/api/force?symbol=${encodeURIComponent(s)}`),
      refetchInterval: pollMs,
      staleTime: 30_000,
      retry: 1,
    })),
  });

  const liqAgg = useMemo(() => {
    const orders: Array<{
      symbol: string;
      side: "BUY" | "SELL";
      price: number;
      qty: number;
      value: number;
      time: number;
    }> = [];
    liqQueries.forEach((q, idx) => {
      const v = q.data;
      if (!Array.isArray(v)) return;
      v.forEach((o) => {
        const price = parseNum(o.price);
        const qty = parseNum(o.origQty);
        const value = price * qty;
        if (!Number.isFinite(value)) return;
        orders.push({
          symbol: LIQ_SYMBOLS[idx].replace("USDT", ""),
          side: o.side,
          price,
          qty,
          value,
          time: o.time,
        });
      });
    });
    orders.sort((a, b) => b.value - a.value);
    const top = orders.slice(0, 12);
    const total = orders.reduce((s, o) => s + o.value, 0);
    return { top, total };
  }, [liqQueries]);

  const oiQueries = useQueries({
    queries: OI_SYMBOLS.map((s) => ({
      queryKey: qk.openInterestHist(s),
      queryFn: async () =>
        await fetchProxyJson<BinanceOpenInterestHistRaw[]>(
          `https://fapi.binance.com/futures/data/openInterestHist?symbol=${encodeURIComponent(s)}&period=5m&limit=2`
        ),
      refetchInterval: pollMs,
      staleTime: 30_000,
      retry: 1,
    })),
  });

  const oiChanges = useMemo(() => {
    const out: Array<{ symbol: string; oi: number; change: number }> = [];
    oiQueries.forEach((q, idx) => {
      const v = q.data;
      if (!Array.isArray(v) || v.length < 2) return;
      const latest = parseNum(v[v.length - 1]?.sumOpenInterest);
      const prev = parseNum(v[0]?.sumOpenInterest);
      if (!(latest > 0 && prev > 0)) return;
      const pct = ((latest - prev) / prev) * 100;
      if (Math.abs(pct) > 0.3) {
        out.push({ symbol: OI_SYMBOLS[idx].replace("USDT", ""), oi: latest, change: pct });
      }
    });
    out.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    return out;
  }, [oiQueries]);

  const lsQueries = useQueries({
    queries: LS_SYMBOLS.map((s) => ({
      queryKey: qk.lsRatio(s),
      queryFn: async () => await fetchJson<BinanceLongShortRatioRaw[]>(`/api/ls?symbol=${encodeURIComponent(s)}`),
      refetchInterval: pollMs,
      staleTime: 30_000,
      retry: 1,
    })),
  });

  const priceList = useMemo(
    () => sortPriceList(priceQ.data || [], priceMode, settings.topPrice),
    [priceQ.data, priceMode, settings.topPrice]
  );

  const liqPartial = useMemo(() => {
    const failedIdx = LIQ_SYMBOLS.map((_, i) => i).filter((i) => liqQueries[i]?.isError);
    const failedSyms = failedIdx.map((i) => LIQ_SYMBOLS[i].replace("USDT", ""));
    return { failedCount: failedIdx.length, failedSyms, okCount: LIQ_SYMBOLS.length - failedIdx.length };
  }, [liqQueries]);

  const oiPartial = useMemo(() => {
    const failedIdx = OI_SYMBOLS.map((_, i) => i).filter((i) => oiQueries[i]?.isError);
    const failedSyms = failedIdx.map((i) => OI_SYMBOLS[i].replace("USDT", ""));
    return { failedCount: failedIdx.length, failedSyms, okCount: OI_SYMBOLS.length - failedIdx.length };
  }, [oiQueries]);

  const lsPanelRows = useMemo(() => {
    return LS_SYMBOLS.map((sym, idx) => {
      const q = lsQueries[idx];
      const label = sym.replace("USDT", "");
      if (q?.isError) {
        return { kind: "error" as const, symbol: label, message: errMsg(q.error) };
      }
      const v = q?.data;
      if (!Array.isArray(v) || v.length === 0) {
        return { kind: "empty" as const, symbol: label };
      }
      const d = v[0];
      const ratio = parseNum(d.longShortRatio);
      const longPct = parseNum(d.longAccount) * 100;
      const shortPct = parseNum(d.shortAccount) * 100;
      if (!Number.isFinite(ratio) || !Number.isFinite(longPct) || !Number.isFinite(shortPct)) {
        return { kind: "empty" as const, symbol: label };
      }
      return { kind: "ok" as const, symbol: label, ratio, longPct, shortPct };
    });
  }, [lsQueries]);

  const lsPartial = useMemo(() => {
    const failed = lsPanelRows.filter((r) => r.kind === "error");
    return { failedCount: failed.length, failedSyms: failed.map((r) => r.symbol) };
  }, [lsPanelRows]);

  const maxBar = useMemo(() => {
    const list = priceList;
    if (!list.length) return 1;
    const vals = list.map((t) => Math.abs(priceMode === "vol" ? t.volume : t.change));
    return Math.max(1, ...vals);
  }, [priceList, priceMode]);

  const lastUpdateText = useMemo(() => {
    const t = Math.max(
      priceQ.dataUpdatedAt || 0,
      fundingQ.dataUpdatedAt || 0,
      ...liqQueries.map((q) => q.dataUpdatedAt || 0),
      ...oiQueries.map((q) => q.dataUpdatedAt || 0),
      ...lsQueries.map((q) => q.dataUpdatedAt || 0)
    );
    if (!t) return "--";
    const d = new Date(t);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss} 更新`;
  }, [priceQ.dataUpdatedAt, fundingQ.dataUpdatedAt, liqQueries, oiQueries, lsQueries]);

  const isRefreshing = priceQ.isFetching || fundingQ.isFetching || liqQueries.some((q) => q.isFetching) || oiQueries.some((q) => q.isFetching) || lsQueries.some((q) => q.isFetching);

  const fapiBlocked =
    isFapiTimeout(validSymbolsQ.error) ||
    isFapiTimeout(priceQ.error) ||
    isFapiTimeout(fundingQ.error) ||
    oiQueries.some((q) => isFapiTimeout(q.error)) ||
    lsQueries.some((q) => isFapiTimeout(q.error)) ||
    liqQueries.some((q) => isFapiTimeout(q.error));

  return (
    <main style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="section-label">市场监控</div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">显示与刷新</div>
          <span className="panel-badge badge-blue">本地保存</span>
        </div>
        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
              alignItems: "end",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)" }}>
              自动刷新
              <select
                className="form-select input-monospace"
                value={settings.refreshSec}
                onChange={(e) => patchSettings({ refreshSec: Number(e.target.value) as MonitorSettings["refreshSec"] })}
                style={{ width: "100%", minWidth: 0 }}
              >
                <option value={0}>关闭（仅手动）</option>
                <option value={30}>每 30 秒</option>
                <option value={60}>每 60 秒</option>
                <option value={120}>每 120 秒</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)" }}>
              价格榜条数
              <select
                className="form-select input-monospace"
                value={settings.topPrice}
                onChange={(e) => patchSettings({ topPrice: Number(e.target.value) as MonitorSettings["topPrice"] })}
                style={{ width: "100%", minWidth: 0 }}
              >
                <option value={10}>Top 10</option>
                <option value={15}>Top 15</option>
                <option value={20}>Top 20</option>
                <option value={30}>Top 30</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)" }}>
              黑马信号条数
              <select
                className="form-select input-monospace"
                value={settings.topHorse}
                onChange={(e) => patchSettings({ topHorse: Number(e.target.value) as MonitorSettings["topHorse"] })}
                style={{ width: "100%", minWidth: 0 }}
              >
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
                <option value={15}>Top 15</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)" }}>
              资金费率条数
              <select
                className="form-select input-monospace"
                value={settings.topFunding}
                onChange={(e) => patchSettings({ topFunding: Number(e.target.value) as MonitorSettings["topFunding"] })}
                style={{ width: "100%", minWidth: 0 }}
              >
                <option value={10}>Top 10</option>
                <option value={15}>Top 15</option>
                <option value={20}>Top 20</option>
              </select>
            </label>
          </div>
          <div style={{ marginTop: 10, fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", lineHeight: 1.6 }}>
            选项会写入浏览器 localStorage（键名 ctbox.monitor.settings.v1），刷新页面后仍保留。
          </div>
        </div>
      </div>

      {fapiBlocked ? (
        <div
          className="panel"
          style={{
            borderColor: "rgba(255,61,87,0.35)",
          }}
        >
          <div className="panel-body" style={{ color: "var(--red)", fontSize: "var(--ctbox-text-xs)", lineHeight: 1.7 }}>
            当前环境访问 `fapi.binance.com` 超时（合约数据源不可达）。你已具备“后端出网代理”支持：请在 `apps/api/.env` 设置
            `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY`（例如 `http://127.0.0.1:7890` / `socks5://127.0.0.1:7890`），然后重启
            `npm run dev:api`。
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: "var(--ctbox-text-xs)", color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
          {settings.refreshSec > 0 ? `数据每 ${settings.refreshSec} 秒自动刷新` : "自动刷新已关闭（使用下方「立即刷新」）"} ·{" "}
          <span>{isRefreshing ? "刷新中..." : lastUpdateText}</span>
        </div>
        <button
          onClick={() => {
            validSymbolsQ.refetch();
            priceQ.refetch();
            fundingQ.refetch();
            liqQueries.forEach((q) => q.refetch());
            oiQueries.forEach((q) => q.refetch());
            lsQueries.forEach((q) => q.refetch());
          }}
          style={{
            background: "none",
            border: "1px solid var(--border2)",
            color: "var(--text-muted)",
            fontSize: "var(--ctbox-text-2xs)",
            padding: "5px 14px",
            borderRadius: "var(--r)",
            cursor: "pointer",
            fontFamily: "var(--mono)",
          }}
        >
          ⟳ 立即刷新
        </button>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">🔥 黑马信号</div>
          <span className={`panel-badge ${horses.length ? "badge-red" : "badge-amber"}`}>{horses.length} 个信号</span>
        </div>
        <div className="panel-body">
          <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", marginBottom: 12 }}>
            规则沿用 legacy：价幅 + 量能 + 价量共振 + 近高点（并剔除主流币加权）
          </div>
          {priceQ.isLoading ? (
            <div style={{ color: "var(--text-muted)", fontSize: "var(--ctbox-text-sm)" }}>加载中...</div>
          ) : priceQ.error ? (
            <div style={{ color: "var(--red)", fontSize: "var(--ctbox-text-xs)" }}>{errMsg(priceQ.error)}</div>
          ) : horses.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "var(--ctbox-text-sm)", padding: "8px 0" }}>暂无明显黑马信号，市场整体平稳</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {horses.map((t, i) => {
                const rankEmoji = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
                const maxScore = horses[0]?.score || 1;
                const barW = Math.min(100, (t.score / maxScore) * 100);
                const changeColor = t.change >= 0 ? "var(--green)" : "var(--red)";
                return (
                  <div className="horse-row" key={t.symbol}>
                    <span className="horse-rank">{rankEmoji}</span>
                    <div className="horse-score-wrap">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span className="horse-symbol">{t.symbol}/USDT</span>
                        <span style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", fontFamily: "var(--mono)" }}>信号强度 {t.score}分</span>
                      </div>
                      <div className="horse-score-bar" style={{ width: `${barW.toFixed(1)}%` }} />
                      <div className="horse-signals">
                        {t.signals.map((s) => (
                          <span className="horse-signal-tag" key={s}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-sm)", fontWeight: 700, color: "var(--text)" }}>${fmtPrice(t.price)}</div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-xs)", fontWeight: 700, color: changeColor }}>
                        {t.change >= 0 ? "+" : ""}
                        {t.change.toFixed(2)}%
                      </div>
                      <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)" }}>量能{t.volRatio.toFixed(1)}x</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">价格异动预警</div>
          <span className="panel-badge badge-amber">{(priceQ.data || []).length} 个币种</span>
        </div>
        <div className="panel-body">
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button className={`mon-filter-btn ${priceMode === "up" ? "active" : ""}`} onClick={() => setPriceMode("up")}>
              ▲ 涨幅榜
            </button>
            <button className={`mon-filter-btn ${priceMode === "down" ? "active" : ""}`} onClick={() => setPriceMode("down")}>
              ▼ 跌幅榜
            </button>
            <button className={`mon-filter-btn ${priceMode === "vol" ? "active" : ""}`} onClick={() => setPriceMode("vol")}>
              📊 量能榜
            </button>
          </div>

          {priceQ.isLoading ? (
            <div style={{ color: "var(--text-muted)", fontSize: "var(--ctbox-text-sm)" }}>加载中...</div>
          ) : priceQ.error ? (
            <div style={{ color: "var(--red)", fontSize: "var(--ctbox-text-xs)" }}>{errMsg(priceQ.error)}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "var(--ctbox-text-2xs)",
                  color: "var(--text-muted)",
                  fontFamily: "var(--mono)",
                  paddingBottom: 4,
                  borderBottom: "1px solid var(--border2)",
                }}
              >
                <span style={{ width: 20 }}>#</span>
                <span style={{ width: 56 }}>币种</span>
                <span style={{ flex: 1 }}>{priceMode === "vol" ? "成交额占比" : "涨跌幅"}</span>
                <span style={{ minWidth: 72, textAlign: "right" }}>{priceMode === "vol" ? "量能" : "涨跌"}</span>
                <span style={{ minWidth: 88, textAlign: "right" }}>价格</span>
              </div>
              {priceList.map((t, i) => {
                const isUp = t.change >= 0;
                const color = isUp ? "var(--green)" : "var(--red)";
                const barW =
                  priceMode === "vol"
                    ? Math.min(100, (t.volume / maxBar) * 100)
                    : Math.min(100, (Math.abs(t.change) / maxBar) * 100);
                const barColor = priceMode === "vol" ? "var(--blue)" : isUp ? "var(--green)" : "var(--red)";
                const valText = priceMode === "vol" ? `$${fmt(t.volume)}` : `${isUp ? "+" : ""}${t.change.toFixed(2)}%`;
                return (
                  <div className="mon-row" key={t.symbol}>
                    <span style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", fontFamily: "var(--mono)", width: 20, flexShrink: 0 }}>{i + 1}</span>
                    <span className="mon-symbol">{t.symbol}</span>
                    <div className="mon-bar-wrap">
                      <div className="mon-bar" style={{ width: `${barW.toFixed(1)}%`, background: barColor }} />
                    </div>
                    <span className="mon-val" style={{ color: priceMode === "vol" ? "var(--blue)" : color }}>
                      {valText}
                    </span>
                    <span className="mon-sub">${fmtPrice(t.price)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">资金费率排行</div>
            <span className={`panel-badge ${fundingDisplay.filter((r) => Math.abs(r.rate) > 0.05).length ? "badge-red" : "badge-blue"}`}>
              {fundingDisplay.filter((r) => Math.abs(r.rate) > 0.05).length} 个极端
            </span>
          </div>
          <div className="panel-body">
            <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", marginBottom: 10 }}>费率极高→多头过热；费率极低→空头过热</div>
            {fundingQ.isLoading ? (
              <div style={{ color: "var(--text-muted)", fontSize: "var(--ctbox-text-sm)" }}>加载中...</div>
            ) : fundingQ.error ? (
              <div style={{ color: "var(--red)", fontSize: "var(--ctbox-text-xs)" }}>{errMsg(fundingQ.error)}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {fundingDisplay.map((r) => {
                  const color =
                    r.rate > 0.05 ? "var(--red)" : r.rate < -0.05 ? "var(--green)" : r.rate > 0 ? "var(--gold)" : "var(--cyan)";
                  const barW = Math.min(100, (Math.abs(r.rate) / 0.2) * 100);
                  const tip = r.rate > 0.05 ? "多头过热" : r.rate < -0.05 ? "空头过热" : "";
                  return (
                    <div className="mon-row" key={r.symbol}>
                      <span className="mon-symbol">{r.symbol}</span>
                      <div className="mon-bar-wrap">
                        <div className="mon-bar" style={{ width: `${barW.toFixed(1)}%`, background: color }} />
                      </div>
                      <span className="mon-val" style={{ color }}>
                        {r.rate > 0 ? "+" : ""}
                        {r.rate.toFixed(4)}%
                      </span>
                      <span className="mon-sub" style={{ color }}>
                        {tip}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">大额清算</div>
            <span className="panel-badge badge-red">${fmt(liqAgg.total)} 清算</span>
          </div>
          <div className="panel-body">
            <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", marginBottom: 10 }}>近期大额爆仓订单，方向可作为情绪参考</div>
            {liqQueries.some((q) => q.isLoading) && liqPartial.okCount === 0 && liqPartial.failedCount === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "var(--ctbox-text-sm)" }}>加载中...</div>
            ) : liqPartial.failedCount === LIQ_SYMBOLS.length ? (
              <div style={{ color: "var(--red)", fontSize: "var(--ctbox-text-xs)" }}>全部请求失败（可稍后重试）</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {liqPartial.failedCount > 0 && liqPartial.okCount > 0 ? (
                  <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--gold)", lineHeight: 1.5 }}>
                    部分币种强平数据未拉取：{liqPartial.failedSyms.slice(0, 8).join(", ")}
                    {liqPartial.failedSyms.length > 8 ? " …" : ""}
                  </div>
                ) : null}
                {liqAgg.top.map((o) => {
                  const isBuy = o.side === "BUY";
                  const color = isBuy ? "var(--green)" : "var(--red)";
                  const label = isBuy ? "多头爆仓" : "空头爆仓";
                  const time = new Date(o.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div className="mon-row" key={`${o.symbol}-${o.time}-${o.value}`}>
                      <span className="mon-symbol">{o.symbol}</span>
                      <span style={{ fontSize: "var(--ctbox-text-2xs)", color, fontFamily: "var(--mono)", fontWeight: 700, width: 60, flexShrink: 0 }}>{label}</span>
                      <span style={{ flex: 1, fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-xs)", color: "var(--text-dim)" }}>${fmtPrice(o.price)}</span>
                      <span className="mon-val" style={{ color }}>
                        ${fmt(o.value)}
                      </span>
                      <span className="mon-sub">{time}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">持仓量异动</div>
            <span className="panel-badge badge-purple">{oiChanges.length} 个异动</span>
          </div>
          <div className="panel-body">
            <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", marginBottom: 10 }}>OI大幅增加→主力建仓；OI大幅减少→主力离场</div>
            {oiQueries.some((q) => q.isLoading) && oiPartial.okCount === 0 && oiPartial.failedCount === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "var(--ctbox-text-sm)" }}>加载中...</div>
            ) : oiPartial.failedCount === OI_SYMBOLS.length ? (
              <div style={{ color: "var(--red)", fontSize: "var(--ctbox-text-xs)" }}>全部请求失败（可稍后重试）</div>
            ) : oiChanges.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "var(--ctbox-text-sm)", padding: "8px 0" }}>
                {oiPartial.failedCount > 0 && oiPartial.okCount > 0 ? (
                  <span style={{ display: "block", marginBottom: 8, fontSize: "var(--ctbox-text-2xs)", color: "var(--gold)" }}>
                    部分币种 OI 未拉取：{oiPartial.failedSyms.slice(0, 8).join(", ")}
                    {oiPartial.failedSyms.length > 8 ? " …" : ""}
                  </span>
                ) : null}
                暂无明显OI异动
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {oiPartial.failedCount > 0 && oiPartial.okCount > 0 ? (
                  <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--gold)", lineHeight: 1.5 }}>
                    部分币种 OI 未拉取：{oiPartial.failedSyms.slice(0, 8).join(", ")}
                    {oiPartial.failedSyms.length > 8 ? " …" : ""}
                  </div>
                ) : null}
                {oiChanges.map((o) => {
                  const isUp = o.change >= 0;
                  const color = isUp ? "var(--green)" : "var(--red)";
                  const label = isUp ? "主力建仓" : "主力离场";
                  const barW = Math.min(100, (Math.abs(o.change) / 5) * 100);
                  return (
                    <div className="mon-row" key={o.symbol}>
                      <span className="mon-symbol">{o.symbol}</span>
                      <div className="mon-bar-wrap">
                        <div className="mon-bar" style={{ width: `${barW.toFixed(1)}%`, background: color }} />
                      </div>
                      <span className="mon-val" style={{ color }}>
                        {isUp ? "+" : ""}
                        {o.change.toFixed(2)}%
                      </span>
                      <span className="mon-sub" style={{ color }}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">多空比监控</div>
            <span className="panel-badge badge-blue">{LS_SYMBOLS.length} 个币种</span>
          </div>
          <div className="panel-body">
            <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", marginBottom: 10 }}>多空比极端时往往预示反转</div>
            {lsQueries.some((q) => q.isLoading) && lsQueries.every((q) => !q.data && !q.isError) ? (
              <div style={{ color: "var(--text-muted)", fontSize: "var(--ctbox-text-sm)" }}>加载中...</div>
            ) : lsPartial.failedCount === LS_SYMBOLS.length ? (
              <div style={{ color: "var(--red)", fontSize: "var(--ctbox-text-xs)" }}>全部请求失败（可稍后重试）</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lsPartial.failedCount > 0 && lsPartial.failedCount < LS_SYMBOLS.length ? (
                  <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--gold)", lineHeight: 1.5 }}>
                    部分币种多空比未拉取：{lsPartial.failedSyms.join(", ")}
                  </div>
                ) : null}
                {lsPanelRows.map((r) => {
                  if (r.kind === "error") {
                    return (
                      <div
                        key={r.symbol}
                        style={{
                          marginBottom: 6,
                          padding: "8px 10px",
                          borderRadius: "var(--r)",
                          border: "1px solid rgba(255,61,87,0.25)",
                          fontSize: "var(--ctbox-text-xs)",
                          color: "var(--text-muted)",
                        }}
                      >
                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{r.symbol}</span>
                        <span style={{ marginLeft: 8, fontFamily: "var(--mono)", fontSize: "var(--ctbox-text-2xs)", color: "var(--red)" }}>{r.message}</span>
                      </div>
                    );
                  }
                  if (r.kind === "empty") {
                    return (
                      <div key={r.symbol} style={{ marginBottom: 6, fontSize: "var(--ctbox-text-xs)", color: "var(--text-muted)" }}>
                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{r.symbol}</span>
                        <span style={{ marginLeft: 8 }}>暂无数据</span>
                      </div>
                    );
                  }
                  const extreme = r.ratio > 1.5 ? "多头过热" : r.ratio < 0.7 ? "空头过热" : "";
                  const exColor = r.ratio > 1.5 ? "var(--red)" : r.ratio < 0.7 ? "var(--green)" : "";
                  return (
                    <div key={r.symbol} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--ctbox-text-2xs)", fontFamily: "var(--mono)", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{r.symbol}</span>
                        <span style={{ color: "var(--text-muted)" }}>
                          多空比 <span style={{ color: "var(--text)", fontWeight: 700 }}>{r.ratio.toFixed(2)}</span>
                          {extreme ? (
                            <>
                              {" "}
                              · <span style={{ color: exColor }}>{extreme}</span>
                            </>
                          ) : null}
                        </span>
                      </div>
                      <div className="ls-bar-track" style={{ height: 16 }}>
                        <div className="ls-bar-long" style={{ width: `${r.longPct.toFixed(1)}%`, fontSize: "var(--ctbox-text-2xs)" }}>
                          {r.longPct.toFixed(1)}%
                        </div>
                        <div className="ls-bar-short" style={{ fontSize: "var(--ctbox-text-2xs)" }}>{r.shortPct.toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: "var(--ctbox-text-xs)", color: "var(--text-muted)", lineHeight: 1.6 }}>
        黑马/价格榜计算已抽离到 `src/lib/monitorLogic.ts`；显示选项保存在 localStorage。多币种并行请求支持「部分失败」提示与列表共存。
      </div>
    </main>
  );
}

