declare module "@/lib/legacy/indicators.js" {
  export function analyzeAll(klines: (string | number)[][]): {
    indicators: Record<string, { type: string; value: string; desc?: string; bar?: number; group?: string }>;
    closes: number[];
    highs: number[];
    lows: number[];
    volumes: number[];
    price: number;
    fib?: { pct?: number };
  };
}
