const KEY_ACCOUNT = "ev_account";
const KEY_ORDERS = "ev_orders";
const KEY_HISTORY = "ev_history";

export type EvAccount = {
  balance: number;
  totalPnl: number;
  wins: number;
  losses: number;
  followWins: number;
  followLosses: number;
};

export type EvOrder = {
  id: number;
  coin: string;
  direction: "up" | "down";
  amount: number;
  entryPrice: number;
  duration: number;
  expireAt: number;
  followSuggestion: boolean;
  suggestionDir: "up" | "down" | "neutral";
};

export type EvHistoryOrder = EvOrder & {
  exitPrice: number;
  won: boolean;
  pnl: number;
  settledAt: number;
};

const defaultAccount = (): EvAccount => ({
  balance: 1000,
  totalPnl: 0,
  wins: 0,
  losses: 0,
  followWins: 0,
  followLosses: 0,
});

export function loadAccount(): EvAccount {
  if (typeof window === "undefined") return defaultAccount();
  try {
    const saved = localStorage.getItem(KEY_ACCOUNT);
    if (saved) return JSON.parse(saved) as EvAccount;
  } catch {
    /* ignore */
  }
  return defaultAccount();
}

export function saveAccount(acc: EvAccount) {
  localStorage.setItem(KEY_ACCOUNT, JSON.stringify(acc));
}

export function loadOrders(): EvOrder[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY_ORDERS) || "[]") as EvOrder[];
  } catch {
    return [];
  }
}

export function saveOrders(orders: EvOrder[]) {
  localStorage.setItem(KEY_ORDERS, JSON.stringify(orders));
}

export function loadHistory(): EvHistoryOrder[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY_HISTORY) || "[]") as EvHistoryOrder[];
  } catch {
    return [];
  }
}

export function saveHistory(hist: EvHistoryOrder[]) {
  localStorage.setItem(KEY_HISTORY, JSON.stringify(hist.slice(0, 50)));
}

export function resetEventStorage() {
  localStorage.removeItem(KEY_ACCOUNT);
  localStorage.removeItem(KEY_ORDERS);
  localStorage.removeItem(KEY_HISTORY);
}
