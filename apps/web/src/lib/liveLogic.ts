/** 与 legacy `js/analysis.js` 中 `renderLiveStats` / `renderLiveStreamers` 的启发式一致 */

export type LiveDirection = "long" | "short" | "neutral";

const LONG_KW_STATS = ["多", "看多", "做多", "买入", "涨", "long", "bull", "up"];
const SHORT_KW_STATS = ["空", "看空", "做空", "卖出", "跌", "short", "bear", "down"];

const LONG_KW_CARD = ["多", "看多", "做多", "买入", "涨", "long", "bull"];
const SHORT_KW_CARD = ["空", "看空", "做空", "卖出", "跌", "short", "bear"];

export type LiveListItem = {
  id?: number | string;
  live_title?: string;
  name?: string;
  userName?: string;
  live_online_count?: number;
  live_view_count?: number;
  avatar?: string;
  live_url?: string;
  totalFollowerCount?: number;
  live_status?: string;
};

/** `/api/live` 成功响应（与 `apps/api/routes/live.js` 一致） */
export type LiveApiResponse = {
  liveNum: number;
  onlineNum: number;
  viewNum: number;
  allNum: number;
  list: LiveListItem[];
  updated?: number;
  source?: string;
};

function titleLower(title: string) {
  return (title || "").toLowerCase();
}

/** 用于概况条：与 `renderLiveStats` 关键词一致 */
export function classifyTitleForStats(title: string): LiveDirection {
  const t = titleLower(title);
  const isLong = LONG_KW_STATS.some((k) => t.includes(k));
  const isShort = SHORT_KW_STATS.some((k) => t.includes(k));
  if (isLong && !isShort) return "long";
  if (isShort && !isLong) return "short";
  return "neutral";
}

/** 用于卡片角标：与 `renderLiveStreamers` 关键词一致（不含 up/down） */
export function classifyTitleForCard(title: string): LiveDirection {
  const t = titleLower(title);
  const isLong = LONG_KW_CARD.some((k) => t.includes(k));
  const isShort = SHORT_KW_CARD.some((k) => t.includes(k));
  if (isLong && !isShort) return "long";
  if (isShort && !isLong) return "short";
  return "neutral";
}

export type LiveDirectionStats = {
  longCount: number;
  shortCount: number;
  neutralCount: number;
  longPct: number;
  shortPct: number;
  dirLabel: string;
  dirBadgeClass: "badge-green" | "badge-red" | "badge-amber";
  conclusion: string;
};

export function computeLiveDirectionStats(list: LiveListItem[]): LiveDirectionStats {
  let longCount = 0;
  let shortCount = 0;
  let neutralCount = 0;
  for (const item of list) {
    const d = classifyTitleForStats(item.live_title || "");
    if (d === "long") longCount++;
    else if (d === "short") shortCount++;
    else neutralCount++;
  }

  const total = list.length || 1;
  const longPct = Math.round((longCount / total) * 100);
  const shortPct = Math.round((shortCount / total) * 100);

  if (longCount > shortCount * 1.5) {
    return {
      longCount,
      shortCount,
      neutralCount,
      longPct,
      shortPct,
      dirLabel: "多头主导",
      dirBadgeClass: "badge-green",
      conclusion: `当前在线主播中看多方向占主导（${longPct}%），市场整体情绪偏乐观。结合技术指标综合判断，多头信号偏强。`,
    };
  }
  if (shortCount > longCount * 1.5) {
    return {
      longCount,
      shortCount,
      neutralCount,
      longPct,
      shortPct,
      dirLabel: "空头主导",
      dirBadgeClass: "badge-red",
      conclusion: `当前在线主播中看空方向占主导（${shortPct}%），市场整体情绪偏悲观。需注意回调风险。`,
    };
  }
  return {
    longCount,
    shortCount,
    neutralCount,
    longPct,
    shortPct,
    dirLabel: "多空分歧",
    dirBadgeClass: "badge-amber",
    conclusion: "当前主播多空方向分歧较大，市场情绪中性。建议等待方向明朗后再入场。",
  };
}

export type LiveSortKey = "online" | "views" | "followers" | "name";

export function sortLiveList<T extends LiveListItem>(list: T[], sort: LiveSortKey): T[] {
  const copy = [...list];
  switch (sort) {
    case "online":
      copy.sort((a, b) => (b.live_online_count ?? 0) - (a.live_online_count ?? 0));
      break;
    case "views":
      copy.sort((a, b) => (b.live_view_count ?? 0) - (a.live_view_count ?? 0));
      break;
    case "followers":
      copy.sort((a, b) => (b.totalFollowerCount ?? 0) - (a.totalFollowerCount ?? 0));
      break;
    case "name":
      copy.sort((a, b) => (a.name || (a as { userName?: string }).userName || "").localeCompare(b.name || b.userName || ""));
      break;
    default:
      break;
  }
  return copy;
}

export type LiveCoinFilter = "all" | "btc" | "eth" | "sol" | "bnb";

export function filterLiveList<T extends LiveListItem>(list: T[], filter: LiveCoinFilter): T[] {
  if (filter === "all") return list;
  const needle = filter.toUpperCase();
  return list.filter((item) => {
    const hay = `${item.live_title || ""} ${item.name || ""} ${(item as { userName?: string }).userName || ""}`.toUpperCase();
    return hay.includes(needle);
  });
}
