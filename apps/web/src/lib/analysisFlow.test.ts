import { describe, expect, it } from "vitest";
import {
  computeCompositeScore,
  computeNewsSentimentLabel,
  groupBadgeCounts,
  summarizeOrderBook,
} from "./analysisFlow";

describe("computeCompositeScore", () => {
  it("returns LONG when mostly bull", () => {
    const ind: Record<string, { type: string; value: string }> = {};
    for (let i = 0; i < 10; i++) ind[`a${i}`] = { type: "bull", value: "1" };
    for (let i = 0; i < 2; i++) ind[`b${i}`] = { type: "bear", value: "1" };
    const s = computeCompositeScore(ind);
    expect(s.longPct).toBeGreaterThanOrEqual(70);
    expect(s.verdict).toBe("LONG");
  });

  it("returns WAIT when balanced", () => {
    const ind: Record<string, { type: string; value: string }> = {
      x: { type: "bull", value: "1" },
      y: { type: "bear", value: "1" },
    };
    const s = computeCompositeScore(ind);
    expect(s.verdict).toBe("WAIT");
  });
});

describe("computeNewsSentimentLabel", () => {
  it("combines fg, funding, ls and tech", () => {
    const indicators: Record<string, { type: string; value: string }> = {};
    for (let i = 0; i < 8; i++) indicators[`t${i}`] = { type: "bull", value: "x" };
    for (let i = 0; i < 2; i++) indicators[`f${i}`] = { type: "bear", value: "x" };
    const out = computeNewsSentimentLabel(
      indicators,
      { data: [{ value: "75" }] },
      [{ fundingRate: "0.001" }],
      [{ longAccount: "60", shortAccount: "40" }]
    );
    expect(out.label).toBeTruthy();
    expect(out.desc.length).toBeGreaterThan(0);
  });
});

describe("summarizeOrderBook", () => {
  it("returns ok:false for empty", () => {
    expect(summarizeOrderBook(null, 100)).toEqual({ ok: false });
  });

  it("computes spread and depth ratio", () => {
    const depth = {
      bids: [
        [99, 1],
        [98, 2],
      ],
      asks: [
        [101, 1],
        [102, 2],
      ],
    };
    const s = summarizeOrderBook(depth, 100);
    expect(s.ok).toBe(true);
    if (s.ok) {
      expect(s.spread).toBe(2);
      expect(s.bids.length).toBeGreaterThan(0);
      expect(s.asks.length).toBeGreaterThan(0);
    }
  });
});

describe("groupBadgeCounts", () => {
  it("marks bull majority", () => {
    const rows: [string, { type: string; value: string }][] = [
      ["a", { type: "bull", value: "1" }],
      ["b", { type: "bull", value: "1" }],
      ["c", { type: "bear", value: "1" }],
    ];
    const b = groupBadgeCounts(rows);
    expect(b.text).toContain("利多");
  });
});
