/**
 * 浏览器访问后端的统一入口（小白说明版）
 * ----------------------------------------
 * 1）前端运行在浏览器里，不能直接解决「跨域访问交易所」等问题，所以真实请求发到 **你自己的 API**（apps/api）。
 * 2）本文件里的 `API_BASE_URL` 来自环境变量 `NEXT_PUBLIC_API_BASE_URL`（写在 apps/web/.env.local）。
 *    - 本地开发一般填：http://localhost:3000（与 API 端口一致即可）
 *    - 部署到线上则填公网 API 地址
 * 3）`fetchJson`：请求失败会 **抛错**，适合「必须成功」的链路。
 *    `fetchJsonOptional`：失败时返回 **null**，适合分析页那种「多个接口并行，个别挂了也能出页面」的场景。
 */

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

/** 非关键接口：失败时返回 null，不抛错（用于分析页并行聚合等场景）。 */
export async function fetchJsonOptional<T = JsonValue>(
  pathOrUrl: string,
  init?: RequestInit
): Promise<T | null> {
  try {
    return await fetchJson<T>(pathOrUrl, init);
  } catch {
    return null;
  }
}
