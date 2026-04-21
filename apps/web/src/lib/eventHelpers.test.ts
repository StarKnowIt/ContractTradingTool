import { describe, expect, it } from "vitest";
import { durationToKlineInterval } from "./eventHelpers";

describe("durationToKlineInterval", () => {
  it("matches legacy mapping", () => {
    expect(durationToKlineInterval(10)).toBe("1m");
    expect(durationToKlineInterval(30)).toBe("5m");
    expect(durationToKlineInterval(60)).toBe("15m");
    expect(durationToKlineInterval(1440)).toBe("1h");
  });
});
