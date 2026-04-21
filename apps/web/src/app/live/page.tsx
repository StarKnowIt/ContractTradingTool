"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchJson } from "@/lib/api";
import { fmt } from "@/lib/eventFormat";
import {
  type LiveApiResponse,
  type LiveCoinFilter,
  type LiveListItem,
  type LiveSortKey,
  classifyTitleForCard,
  computeLiveDirectionStats,
  filterLiveList,
  sortLiveList,
} from "@/lib/liveLogic";
import { qk } from "@/lib/queryKeys";

function StreamerAvatar({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(!src?.trim());
  if (broken) {
    return (
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "var(--bg3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "var(--ctbox-text-xs)",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {(name || "?").slice(0, 2)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 第三方头像域名不固定
    <img
      src={src}
      alt=""
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        objectFit: "cover",
        background: "var(--bg3)",
      }}
      onError={() => setBroken(true)}
    />
  );
}

function cardDirectionStyle(title: string) {
  const d = classifyTitleForCard(title);
  if (d === "long") return { label: "▲ 看多", color: "var(--green)" };
  if (d === "short") return { label: "▼ 看空", color: "var(--red)" };
  return { label: "→ 中性", color: "var(--gold)" };
}

export default function LivePage() {
  const [sort, setSort] = useState<LiveSortKey>("online");
  const [filter, setFilter] = useState<LiveCoinFilter>("all");

  const query = useQuery({
    queryKey: qk.liveList(),
    queryFn: () => fetchJson<LiveApiResponse>("/api/live"),
    staleTime: 55_000,
  });

  const list = useMemo(() => query.data?.list ?? [], [query.data]);
  const stats = useMemo(() => computeLiveDirectionStats(list as LiveListItem[]), [list]);

  const displayList = useMemo(() => {
    const f = filterLiveList(list as LiveListItem[], filter);
    return sortLiveList(f, sort);
  }, [list, filter, sort]);

  const badgeText = query.data ? `${query.data.liveNum || 0} 个直播中` : "加载中";
  const onlineBadgeText = query.data ? `${query.data.liveNum || 0} 人直播中` : "加载中";

  return (
    <main style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="section-label">广场直播</div>

      {query.isError ? (
        <div style={{ color: "var(--red)", fontSize: "var(--ctbox-text-sm)", lineHeight: 1.6 }}>
          {query.error instanceof Error ? query.error.message : "获取数据失败，请稍后重试"}
        </div>
      ) : null}

      <div className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">直播概况</div>
            <span className={`panel-badge ${query.data?.liveNum ? "badge-green" : "badge-amber"}`}>{badgeText}</span>
          </div>
          <div className="panel-body">
            <div className="futures-grid">
              <div className="futures-card">
                <div className="futures-card-label">正在直播</div>
                <div className="futures-card-value" style={{ color: "var(--red)" }}>
                  {query.isLoading ? "--" : query.data?.liveNum ?? "--"}
                </div>
              </div>
              <div className="futures-card">
                <div className="futures-card-label">在线观众</div>
                <div className="futures-card-value">
                  {query.isLoading ? "--" : fmt(query.data?.onlineNum ?? 0)}
                </div>
              </div>
              <div className="futures-card">
                <div className="futures-card-label">总观看人次</div>
                <div className="futures-card-value">
                  {query.isLoading ? "--" : fmt(query.data?.viewNum ?? 0)}
                </div>
              </div>
              <div className="futures-card">
                <div className="futures-card-label">主播总数</div>
                <div className="futures-card-value">
                  {query.isLoading ? "--" : query.data?.allNum ?? "--"}
                </div>
              </div>
            </div>
            {query.data?.source === "mock" ? (
              <div style={{ marginTop: 10, fontSize: "var(--ctbox-text-xs)", color: "var(--text-muted)" }}>
                当前为演示数据；可在服务端配置真实直播数据源。
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">直播方向分布</div>
            <span className={`panel-badge ${query.isLoading ? "badge-amber" : stats.dirBadgeClass}`}>
              {query.isLoading ? "--" : stats.dirLabel}
            </span>
          </div>
          <div className="panel-body">
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: "var(--ctbox-text-2xs)",
                  color: "var(--text-muted)",
                  fontFamily: "var(--mono)",
                  marginBottom: 6,
                }}
              >
                主播做单方向（基于直播标题分析）
              </div>
              <div className="ls-bar-track">
                <div className="ls-bar-long" style={{ width: `${stats.longPct}%`, flex: "0 0 auto" }}>
                  多
                </div>
                <div className="ls-bar-short" style={{ width: `${stats.shortPct}%`, flex: "0 0 auto" }}>
                  空
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--ctbox-text-2xs)",
                  fontFamily: "var(--mono)",
                  marginTop: 6,
                }}
              >
                <span style={{ color: "var(--green)" }}>
                  ▲ 看多 <span>{query.isLoading ? "--" : stats.longCount}</span> 人
                </span>
                <span style={{ color: "var(--text-muted)" }}>中性 {query.isLoading ? "--" : stats.neutralCount} 人</span>
                <span style={{ color: "var(--red)" }}>
                  看空 <span>{query.isLoading ? "--" : stats.shortCount}</span> 人 ▼
                </span>
              </div>
            </div>
            <div
              id="liveDirConclusion"
              style={{
                fontSize: "var(--ctbox-text-sm)",
                color: "var(--text-dim)",
                lineHeight: 1.7,
                padding: "10px 12px",
                background: "var(--bg2)",
                borderRadius: "var(--r-lg)",
              }}
            >
              {query.isLoading ? "加载中…" : list.length === 0 ? "暂无数据" : stats.conclusion}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="panel-title">在线主播</div>
          <span className="panel-badge badge-red">{onlineBadgeText}</span>

          <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", fontFamily: "var(--mono)" }}>排序</span>
            {(
              [
                ["online", "在线"],
                ["views", "观看"],
                ["followers", "粉丝"],
                ["name", "名称"],
              ] as const
            ).map(([k, lab]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSort(k)}
                style={{
                  fontSize: "var(--ctbox-text-2xs)",
                  padding: "4px 10px",
                  borderRadius: "var(--r)",
                  cursor: "pointer",
                  fontFamily: "var(--mono)",
                  border: "1px solid var(--border2)",
                  background: sort === k ? "rgba(255,107,157,0.12)" : "var(--bg3)",
                  borderColor: sort === k ? "rgba(255,107,157,0.3)" : "var(--border2)",
                  color: sort === k ? "#ff6b9d" : "var(--text-muted)",
                }}
              >
                {lab}
              </button>
            ))}
          </div>

          <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", fontFamily: "var(--mono)" }}>筛选</span>
            {(
              [
                ["all", "全部"],
                ["btc", "BTC"],
                ["eth", "ETH"],
                ["sol", "SOL"],
                ["bnb", "BNB"],
              ] as const
            ).map(([k, lab]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                style={{
                  fontSize: "var(--ctbox-text-2xs)",
                  padding: "4px 10px",
                  borderRadius: "var(--r)",
                  cursor: "pointer",
                  fontFamily: "var(--mono)",
                  border: "1px solid var(--border2)",
                  background: filter === k ? "rgba(255,107,157,0.12)" : "var(--bg3)",
                  borderColor: filter === k ? "rgba(255,107,157,0.3)" : "var(--border2)",
                  color: filter === k ? "#ff6b9d" : "var(--text-muted)",
                }}
              >
                {lab}
              </button>
            ))}

            <button
              type="button"
              disabled={query.isFetching}
              onClick={() => query.refetch()}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "1px solid var(--border2)",
                color: "var(--text-muted)",
                fontSize: "var(--ctbox-text-2xs)",
                padding: "4px 10px",
                borderRadius: "var(--r)",
                cursor: query.isFetching ? "wait" : "pointer",
                fontFamily: "var(--mono)",
              }}
            >
              {query.isFetching ? "⟳ 刷新中…" : "⟳ 刷新"}
            </button>
          </div>
        </div>
        <div className="panel-body">
          <div id="liveStreamerGrid" className="streamer-grid">
            {query.isLoading ? (
              <div style={{ color: "var(--text-muted)", fontSize: "var(--ctbox-text-sm)", padding: "20px 0" }}>加载中...</div>
            ) : !query.data?.list?.length ? (
              <div style={{ color: "var(--text-muted)", fontSize: "var(--ctbox-text-sm)", padding: "20px 0" }}>暂无直播数据</div>
            ) : displayList.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "var(--ctbox-text-sm)", padding: "20px 0" }}>
                当前筛选下无主播
              </div>
            ) : (
              displayList.map((item, idx) => {
                const title = item.live_title || "暂无标题";
                const online = item.live_online_count ?? 0;
                const views = item.live_view_count ?? 0;
                const liveUrl = item.live_url || "";
                const nm = item.name || item.userName || "未知主播";
                const dir = cardDirectionStyle(title);
                const rankColor =
                  idx === 0 ? "#FFD700" : idx === 1 ? "#C0C0C0" : idx === 2 ? "#CD7F32" : "var(--text-muted)";
                return (
                  <div
                    key={String(item.id ?? idx)}
                    className="streamer-card"
                    style={{ cursor: liveUrl ? "pointer" : "default" }}
                    onClick={() => {
                      if (liveUrl) window.open(liveUrl, "_blank", "noopener,noreferrer");
                    }}
                    onKeyDown={(e) => {
                      if (!liveUrl) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        window.open(liveUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                    role={liveUrl ? "link" : undefined}
                    tabIndex={liveUrl ? 0 : undefined}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <StreamerAvatar src={item.avatar || ""} name={nm} />
                        <div
                          style={{
                            position: "absolute",
                            bottom: -2,
                            right: -2,
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: "var(--red)",
                            border: "2px solid var(--bg1)",
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              fontSize: "var(--ctbox-text-sm)",
                              fontWeight: 700,
                              color: "var(--text)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {nm}
                          </span>
                          {idx < 3 ? (
                            <span className="rank-badge" style={{ color: rankColor }}>
                              TOP{idx + 1}
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: "var(--ctbox-text-2xs)", color: "var(--text-muted)", marginTop: 2 }}>
                          粉丝 {fmt(item.totalFollowerCount ?? 0)}
                        </div>
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "var(--ctbox-text-xs)",
                          fontWeight: 700,
                          color: dir.color,
                          flexShrink: 0,
                        }}
                      >
                        {dir.label}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "var(--ctbox-text-xs)",
                        color: "var(--text-dim)",
                        marginBottom: 10,
                        lineHeight: 1.5,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={title}
                    >
                      {title}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "var(--ctbox-text-2xs)",
                        fontFamily: "var(--mono)",
                      }}
                    >
                      <span style={{ color: "var(--red)", display: "flex", alignItems: "center", gap: 4 }}>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--red)",
                            display: "inline-block",
                            animation: "pulse-dot 1.5s infinite",
                          }}
                        />
                        {fmt(Number(online))} 在线
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>
                        👁 {typeof views === "string" ? views : fmt(Number(views))}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
