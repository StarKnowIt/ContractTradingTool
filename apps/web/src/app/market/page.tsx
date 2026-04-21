"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banner,
  Heading,
  Label,
  SegmentedControl,
  Spinner,
  Stack,
  Text,
} from "@primer/react";
import { Table } from "@primer/react/experimental";
import { fetchFuturesTickerTable, fetchTopGainers, type MarketTickerRow } from "@/lib/marketApi";
import {
  DEFAULT_MARKET_SORT,
  loadMarketSort,
  saveMarketSort,
  type MarketSortMode,
} from "@/lib/marketSettings";
import { qk } from "@/lib/queryKeys";

const TIMEFRAMES = ["5m", "30m", "4h", "12h"] as const;
const HEATMAP_N = 72;

function parseNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function fmtVol(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(0);
}

function fmtPrice(n: number | null) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtPct(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
}

function pctColorClass(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "ctbox-market-pct-muted";
  if (n > 0) return "ctbox-market-pct-up";
  if (n < 0) return "ctbox-market-pct-down";
  return "ctbox-market-pct-muted";
}

function shortSym(symbol: string) {
  return symbol.replace(/USDT$/i, "");
}

function heatmapCellStyle(pct: number | null, maxAbs: number) {
  if (maxAbs <= 0 || pct == null || !Number.isFinite(pct)) {
    return { backgroundColor: "var(--bgColor-muted, var(--color-canvas-subtle))" };
  }
  const t = Math.min(1, Math.abs(pct) / maxAbs);
  const alpha = 0.12 + t * 0.38;
  if (pct >= 0) {
    return {
      backgroundColor: `color-mix(in srgb, var(--fgColor-success, #57ab5a) ${Math.round(alpha * 100)}%, var(--bgColor-muted, #21262d))`,
    };
  }
  return {
    backgroundColor: `color-mix(in srgb, var(--fgColor-danger, #e5534b) ${Math.round(alpha * 100)}%, var(--bgColor-muted, #21262d))`,
  };
}

export default function MarketPage() {
  const [sortMode, setSortMode] = useState<MarketSortMode>(DEFAULT_MARKET_SORT);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setSortMode(loadMarketSort());
      setMounted(true);
    });
  }, []);

  function setSort(next: MarketSortMode) {
    setSortMode(next);
    saveMarketSort(next);
  }

  const tickersQ = useQuery({
    queryKey: qk.futuresTickers(),
    queryFn: fetchFuturesTickerTable,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const gainersQ = useQuery({
    queryKey: qk.topGainers(),
    queryFn: fetchTopGainers,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });

  const sortedRows = useMemo(() => {
    const rows = tickersQ.data?.rows ?? [];
    const copy = [...rows];
    if (sortMode === "vol") {
      copy.sort((a, b) => (parseNum(b.quoteVolume) ?? 0) - (parseNum(a.quoteVolume) ?? 0));
    } else if (sortMode === "pct") {
      copy.sort((a, b) => (parseNum(b.percentage) ?? -1e9) - (parseNum(a.percentage) ?? -1e9));
    } else {
      copy.sort((a, b) => a.symbol.localeCompare(b.symbol));
    }
    return copy;
  }, [tickersQ.data?.rows, sortMode]);

  const heatmapRows = useMemo(() => {
    const rows = tickersQ.data?.rows ?? [];
    const byVol = [...rows].sort(
      (a, b) => (parseNum(b.quoteVolume) ?? 0) - (parseNum(a.quoteVolume) ?? 0)
    );
    return byVol.slice(0, HEATMAP_N);
  }, [tickersQ.data?.rows]);

  const heatmapMaxAbs = useMemo(() => {
    let m = 0;
    for (const r of heatmapRows) {
      const p = parseNum(r.percentage);
      if (p != null) m = Math.max(m, Math.abs(p));
    }
    return m || 1;
  }, [heatmapRows]);

  const tickerGridCols =
    "minmax(104px, 1.1fr) minmax(88px, auto) minmax(88px, auto) minmax(88px, auto) minmax(88px, auto) minmax(80px, auto) minmax(96px, auto) minmax(104px, auto)";

  const gainerGridCols = `40px minmax(100px, 1fr) minmax(88px, auto) minmax(72px, auto) ${TIMEFRAMES.map(() => "minmax(64px, auto)").join(" ")} minmax(96px, auto)`;

  return (
    <Stack direction="vertical" gap="spacious" padding="spacious" style={{ maxWidth: "100%" }}>
      <Stack direction="vertical" gap="condensed">
        <Heading as="h1" style={{ fontSize: "var(--ctbox-text-xl)" }}>
          市场大盘
        </Heading>
        <Text style={{ fontSize: "var(--ctbox-text-base)", display: "block", color: "var(--fgColor-muted)" }}>
          默认交易所：<Label variant="accent">Binance</Label> USDT 永续 · 数据来自 CCXT 聚合（Ticker 可提供的字段；多周期为相对上一根 K 收盘的近似）
        </Text>
      </Stack>

      {gainersQ.isError ? (
        <Banner variant="critical" title="涨幅榜加载失败">
          {gainersQ.error instanceof Error ? gainersQ.error.message : String(gainersQ.error)}
        </Banner>
      ) : null}

      {!gainersQ.isLoading && !gainersQ.isError && (gainersQ.data?.items?.length ?? 0) === 0 ? (
        <Banner variant="info" title="暂无涨幅榜数据">
          请确认本机已启动 API（含 CCXT）且能访问 Binance；或稍后重试。
        </Banner>
      ) : null}

      <Stack direction="vertical" gap="normal">
        <Stack direction="horizontal" gap="normal" align="center" justify="space-between" wrap="wrap">
          <Heading as="h2" id="gainers-heading" style={{ fontSize: "var(--ctbox-text-lg)" }}>
            24h 涨幅榜 Top 20 · 多周期
          </Heading>
          {gainersQ.isFetching ? <Spinner size="small" /> : null}
        </Stack>
        <div style={{ overflowX: "auto" }}>
          <Table.Container>
            <Table
              aria-labelledby="gainers-heading"
              cellPadding="condensed"
              style={{ minWidth: 720 }}
              gridTemplateColumns={gainerGridCols}
            >
              <Table.Head>
                <Table.Row>
                  <Table.Header>#</Table.Header>
                  <Table.Header>交易对</Table.Header>
                  <Table.Header align="end">最新</Table.Header>
                  <Table.Header align="end">24h</Table.Header>
                  {TIMEFRAMES.map((tf) => (
                    <Table.Header key={tf} align="end">
                      {tf}
                    </Table.Header>
                  ))}
                  <Table.Header align="end">24h 额(USDT)</Table.Header>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {gainersQ.isLoading ? (
                  <Table.Row>
                    <Table.Cell colSpan={5 + TIMEFRAMES.length}>
                      <Stack direction="horizontal" gap="normal" align="center">
                        <Spinner />
                        <Text>加载多周期数据…</Text>
                      </Stack>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  (gainersQ.data?.items ?? []).map((it, i) => (
                    <Table.Row key={it.symbol}>
                      <Table.Cell>{i + 1}</Table.Cell>
                      <Table.Cell scope="row">
                        <Text weight="semibold">{it.symbol}</Text>
                      </Table.Cell>
                      <Table.Cell align="end">{fmtPrice(it.last)}</Table.Cell>
                      <Table.Cell align="end">
                        <span className={pctColorClass(it.pct24h)}>{fmtPct(it.pct24h)}</span>
                      </Table.Cell>
                      {TIMEFRAMES.map((tf) => (
                        <Table.Cell key={tf} align="end">
                          <span className={pctColorClass(it.periods[tf] ?? null)}>
                            {fmtPct(it.periods[tf] ?? null)}
                          </span>
                        </Table.Cell>
                      ))}
                      <Table.Cell align="end">{fmtVol(it.quoteVolume)}</Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table>
          </Table.Container>
        </div>
      </Stack>

      <Stack direction="vertical" gap="normal">
        <Heading as="h2" id="heatmap-heading" style={{ fontSize: "var(--ctbox-text-lg)" }}>
          24h 热力图（按成交额 Top {HEATMAP_N}）
        </Heading>
        <Text style={{ fontSize: "var(--ctbox-text-sm)", display: "block", color: "var(--fgColor-muted)" }}>
          色块深浅表示 24h 涨跌幅绝对值相对强度；绿涨红跌。
        </Text>
        {tickersQ.isLoading ? (
          <Spinner />
        ) : (
          <div
            className="ctbox-market-heatmap"
            role="img"
            aria-label="24 小时涨跌幅热力图"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
              gap: "var(--base-size-4, 4px)",
            }}
          >
            {heatmapRows.map((r: MarketTickerRow) => {
              const p = parseNum(r.percentage);
              return (
                <div
                  key={r.symbol}
                  title={`${r.symbol} ${fmtPct(p)}`}
                  className="ctbox-market-heatmap-cell"
                  style={{
                    ...heatmapCellStyle(p, heatmapMaxAbs),
                    borderRadius: "var(--borderRadius-medium, 6px)",
                    padding: "var(--base-size-8, 8px) var(--base-size-4, 4px)",
                    minHeight: 44,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--borderColor-muted, var(--color-border-muted))",
                  }}
                >
                  <Text
                    as="span"
                    style={{ fontSize: "var(--ctbox-text-2xs)", fontWeight: 600 }}
                    className={pctColorClass(p)}
                  >
                    {shortSym(r.symbol)}
                  </Text>
                  <Text as="span" style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--fgColor-muted)" }}>
                    {fmtPct(p)}
                  </Text>
                </div>
              );
            })}
          </div>
        )}
      </Stack>

      {tickersQ.isError ? (
        <Banner variant="critical" title="Ticker 表加载失败">
          {tickersQ.error instanceof Error ? tickersQ.error.message : String(tickersQ.error)}
        </Banner>
      ) : null}

      {!tickersQ.isLoading && !tickersQ.isError && (tickersQ.data?.rows?.length ?? 0) === 0 ? (
        <Banner variant="info" title="暂无 Ticker 数据">
          请确认 API 已启动且 <code>NEXT_PUBLIC_API_BASE_URL</code> 指向正确地址。
        </Banner>
      ) : null}

      <Stack direction="vertical" gap="normal">
        <Stack direction="horizontal" gap="normal" align="center" justify="space-between" wrap="wrap">
          <Heading as="h2" id="ticker-heading" style={{ fontSize: "var(--ctbox-text-lg)" }}>
            全市场 Ticker
          </Heading>
          <SegmentedControl aria-label="排序方式">
            <SegmentedControl.Button selected={sortMode === "vol"} onClick={() => setSort("vol")}>
              成交额
            </SegmentedControl.Button>
            <SegmentedControl.Button selected={sortMode === "pct"} onClick={() => setSort("pct")}>
              24h 涨跌
            </SegmentedControl.Button>
            <SegmentedControl.Button selected={sortMode === "sym"} onClick={() => setSort("sym")}>
              名称
            </SegmentedControl.Button>
          </SegmentedControl>
        </Stack>
        <div style={{ overflowX: "auto" }}>
          <Table.Container>
            <Table
              aria-labelledby="ticker-heading"
              cellPadding="condensed"
              style={{ minWidth: 900 }}
              gridTemplateColumns={tickerGridCols}
            >
              <Table.Head>
                <Table.Row>
                  <Table.Header>交易对</Table.Header>
                  <Table.Header align="end">最新</Table.Header>
                  <Table.Header align="end">高</Table.Header>
                  <Table.Header align="end">低</Table.Header>
                  <Table.Header align="end">开</Table.Header>
                  <Table.Header align="end">24h%</Table.Header>
                  <Table.Header align="end">基础量</Table.Header>
                  <Table.Header align="end">计价成交额</Table.Header>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {tickersQ.isLoading ? (
                  <Table.Row>
                    <Table.Cell colSpan={8}>
                      <Stack direction="horizontal" gap="normal" align="center">
                        <Spinner />
                        <Text>加载全量 Ticker…</Text>
                      </Stack>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  sortedRows.map((r) => {
                    const pct = parseNum(r.percentage);
                    return (
                      <Table.Row key={r.symbol}>
                        <Table.Cell scope="row">
                          <Text weight="semibold">{r.symbol}</Text>
                        </Table.Cell>
                        <Table.Cell align="end">{fmtPrice(parseNum(r.last))}</Table.Cell>
                        <Table.Cell align="end">{fmtPrice(parseNum(r.high))}</Table.Cell>
                        <Table.Cell align="end">{fmtPrice(parseNum(r.low))}</Table.Cell>
                        <Table.Cell align="end">{fmtPrice(parseNum(r.open))}</Table.Cell>
                        <Table.Cell align="end">
                          <span className={pctColorClass(pct)}>{fmtPct(pct)}</span>
                        </Table.Cell>
                        <Table.Cell align="end">{fmtVol(parseNum(r.baseVolume))}</Table.Cell>
                        <Table.Cell align="end">{fmtVol(parseNum(r.quoteVolume))}</Table.Cell>
                      </Table.Row>
                    );
                  })
                )}
              </Table.Body>
            </Table>
          </Table.Container>
        </div>
      </Stack>

      {mounted && tickersQ.data?.fetchedAt ? (
        <Text style={{ fontSize: "var(--ctbox-text-xs)", display: "block", color: "var(--fgColor-muted)" }}>
          Ticker 快照时间：{new Date(tickersQ.data.fetchedAt).toLocaleString("zh-CN")}
          {gainersQ.data?.fetchedAt
            ? ` · 涨幅榜：${new Date(gainersQ.data.fetchedAt).toLocaleString("zh-CN")}`
            : ""}
        </Text>
      ) : null}
    </Stack>
  );
}
