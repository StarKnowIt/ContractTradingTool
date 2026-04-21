import { describe, expect, it } from "vitest";
import {
  classifyTitleForCard,
  classifyTitleForStats,
  computeLiveDirectionStats,
  filterLiveList,
  sortLiveList,
} from "./liveLogic";

describe("classifyTitleForStats", () => {
  it("detects long / short / neutral", () => {
    expect(classifyTitleForStats("BTC 做多看涨")).toBe("long");
    expect(classifyTitleForStats("btc short term")).toBe("short");
    expect(classifyTitleForStats("横盘观察")).toBe("neutral");
  });
});

describe("computeLiveDirectionStats", () => {
  it("returns long-dominant when ratio holds", () => {
    const r = computeLiveDirectionStats([
      { live_title: "看多" },
      { live_title: "做多" },
      { live_title: "做多" },
      { live_title: "中性" },
    ]);
    expect(r.dirLabel).toBe("多头主导");
    expect(r.dirBadgeClass).toBe("badge-green");
  });
});

describe("sortLiveList", () => {
  it("sorts by online desc", () => {
    const r = sortLiveList(
      [
        { live_online_count: 1 },
        { live_online_count: 10 },
        { live_online_count: 5 },
      ],
      "online"
    );
    expect(r.map((x) => x.live_online_count)).toEqual([10, 5, 1]);
  });
});

describe("filterLiveList", () => {
  it("filters by symbol substring in title or name", () => {
    const r = filterLiveList(
      [
        { live_title: "ETH 突破", name: "A" },
        { live_title: "BTC 震荡", name: "B" },
      ],
      "btc"
    );
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("B");
  });
});

describe("classifyTitleForCard", () => {
  it("matches card keyword set (no bare up/down)", () => {
    expect(classifyTitleForCard("follow up")).toBe("neutral");
  });
});
