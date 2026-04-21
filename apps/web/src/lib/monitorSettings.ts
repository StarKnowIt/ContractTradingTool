export type MonitorSettings = {
  /** 0 = 仅手动刷新 */
  refreshSec: 0 | 30 | 60 | 120;
  topPrice: 10 | 15 | 20 | 30;
  topHorse: 5 | 10 | 15;
  topFunding: 10 | 15 | 20;
};

const STORAGE_KEY = "ctbox.monitor.settings.v1";

export const DEFAULT_MONITOR_SETTINGS: MonitorSettings = {
  refreshSec: 60,
  topPrice: 15,
  topHorse: 10,
  topFunding: 15,
};

function parseSettings(raw: unknown): MonitorSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_MONITOR_SETTINGS };
  const o = raw as Record<string, unknown>;
  const refreshSec = [0, 30, 60, 120].includes(o.refreshSec as number) ? (o.refreshSec as MonitorSettings["refreshSec"]) : DEFAULT_MONITOR_SETTINGS.refreshSec;
  const topPrice = [10, 15, 20, 30].includes(o.topPrice as number) ? (o.topPrice as MonitorSettings["topPrice"]) : DEFAULT_MONITOR_SETTINGS.topPrice;
  const topHorse = [5, 10, 15].includes(o.topHorse as number) ? (o.topHorse as MonitorSettings["topHorse"]) : DEFAULT_MONITOR_SETTINGS.topHorse;
  const topFunding = [10, 15, 20].includes(o.topFunding as number) ? (o.topFunding as MonitorSettings["topFunding"]) : DEFAULT_MONITOR_SETTINGS.topFunding;
  return { refreshSec, topPrice, topHorse, topFunding };
}

export function loadMonitorSettings(): MonitorSettings {
  if (typeof window === "undefined") return { ...DEFAULT_MONITOR_SETTINGS };
  try {
    const s = window.localStorage.getItem(STORAGE_KEY);
    if (!s) return { ...DEFAULT_MONITOR_SETTINGS };
    return parseSettings(JSON.parse(s));
  } catch {
    return { ...DEFAULT_MONITOR_SETTINGS };
  }
}

export function saveMonitorSettings(next: MonitorSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
