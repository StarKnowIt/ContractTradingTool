export const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

export async function fetchJson<T = JsonValue>(
  pathOrUrl: string,
  init?: RequestInit
): Promise<T> {
  const url =
    pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")
      ? pathOrUrl
      : `${API_BASE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

  if (!url || url.startsWith("/")) {
    throw new ApiError(
      "API_BASE_URL 未配置：请设置 NEXT_PUBLIC_API_BASE_URL（例如 http://localhost:3000）"
    );
  }

  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(`HTTP ${res.status}${text ? `: ${text}` : ""}`, res.status);
  }
  return (await res.json()) as T;
}

