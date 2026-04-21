import { describe, expect, it } from "vitest";
import { computeHorseSignals, sortPriceList } from "./monitorLogic";

const sample: Parameters<typeof sortPriceList>[0] = [
  { symbol: "AAA", price: 1, change: 10, volume: 1e8, high: 2, low: 0.5 },
  { symbol: "BBB", price: 2, change: -5, volume: 5e7, high: 3, low: 1 },
  { symbol: "CCC", price: 3, change: 20, volume: 9e7, high: 4, low: 2 },
];

describe("sortPriceList", () => {
  it("sorts by up change and respects topN", () => {
    const r = sortPriceList(sample, "up", 2);
    expect(r.map((x) => x.symbol)).toEqual(["CCC", "AAA"]);
  });
  it("sorts by volume", () => {
    const r = sortPriceList(sample, "vol", 3);
    expect(r[0].symbol).toBe("AAA");
  });
});

describe("computeHorseSignals", () => {
  it("returns empty when no rows", () => {
    expect(computeHorseSignals([], { topHorse: 10 })).toEqual([]);
  });
});
