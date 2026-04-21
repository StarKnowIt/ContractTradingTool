/**
 * 出站 HTTP 封装（给各 route 复用）
 * --------------------------------
 * 为什么要有这一层？
 * - 各交易所接口可能偶发超时、限流；这里做「有限次重试 + 指数退避」，减少偶发抖动。
 * - 可通过环境变量走 HTTP/SOCKS 代理（见 apps/api/.env.example）。
 * - `fetchJSON` 在 URL 维度带短 TTL 内存缓存，减轻重复打上游的压力。
 *
 * 环境变量：FETCH_TIMEOUT_MS、FETCH_MAX_RETRIES、FETCH_LOG_RETRIES、HTTP(S)_PROXY 等。
 */
const rawFetch = require('node-fetch');
const { cGet, cSet } = require('./cache');
const { ProxyAgent } = require('proxy-agent');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getDefaultTimeout() {
  const n = Number(process.env.FETCH_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? Math.min(120000, n) : 10000;
}

function getMaxRetries() {
  const n = Number(process.env.FETCH_MAX_RETRIES);
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 2;
}

function backoffMs(attempt) {
  return Math.min(8000, 400 * 2 ** attempt);
}

function isRetryableStatus(status) {
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function isRetryableErrorMessage(msg) {
  return /timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up|TLS|SSL|EPIPE|UND_ERR/i.test(
    String(msg)
  );
}

function logRetry(url, attempt, detail, delayMs) {
  if (process.env.FETCH_LOG_RETRIES !== '1' && process.env.NODE_ENV === 'production') return;
  try {
    const u = new URL(url);
    console.warn(`[fetch] retry host=${u.hostname} attempt=${attempt + 1} after=${delayMs}ms detail=${detail}`);
  } catch {
    console.warn(`[fetch] retry attempt=${attempt + 1} after=${delayMs}ms detail=${detail}`);
  }
}

// 代理支持：读取 .env 中的 HTTP_PROXY / HTTPS_PROXY / ALL_PROXY（大小写均支持）
let _proxyKey = '';
let _proxyAgent = null;
function getProxyAgentForUrl(url) {
  const isHttps = typeof url === 'string' && url.startsWith('https://');

  const allProxy = process.env.ALL_PROXY || process.env.all_proxy || '';
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy || '';
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || '';

  const proxy = (allProxy || (isHttps ? httpsProxy : httpProxy) || '').trim();
  if (!proxy) return undefined;

  const key = `${proxy}`;
  if (_proxyAgent && _proxyKey === key) return _proxyAgent;
  _proxyKey = key;
  _proxyAgent = new ProxyAgent(proxy);
  return _proxyAgent;
}

/**
 * 带超时、代理与有限次重试的 fetch（对可恢复错误做指数退避）。
 * 与 node-fetch 兼容的 (url, options) 签名；默认补全 UA 与 timeout。
 */
async function fetchWithRetry(url, options = {}) {
  const timeout = options.timeout != null ? options.timeout : getDefaultTimeout();
  const maxRetries = getMaxRetries();
  const agent = options.agent !== undefined ? options.agent : getProxyAgentForUrl(url);
  const headers = { 'User-Agent': UA, ...options.headers };

  let lastResponse = null;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const r = await rawFetch(String(url), {
        ...options,
        headers,
        timeout,
        agent,
      });
      lastResponse = r;
      if (r.ok) return r;
      if (attempt < maxRetries && isRetryableStatus(r.status)) {
        const d = backoffMs(attempt);
        logRetry(url, attempt, `HTTP ${r.status}`, d);
        await sleep(d);
        continue;
      }
      return r;
    } catch (err) {
      lastError = err;
      const msg = err && err.message ? err.message : String(err);
      if (attempt < maxRetries && isRetryableErrorMessage(msg)) {
        const d = backoffMs(attempt);
        logRetry(url, attempt, msg, d);
        await sleep(d);
        continue;
      }
      throw err;
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('fetch failed');
}

async function fetchJSON(url, ttlMs = 15000) {
  const cached = cGet(url);
  if (cached) return cached;
  const r = await fetchWithRetry(url, {
    headers: { 'User-Agent': UA },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  cSet(url, data, ttlMs);
  return data;
}

module.exports = { fetch: fetchWithRetry, fetchJSON, UA };
