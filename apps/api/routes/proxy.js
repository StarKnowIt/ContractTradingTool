// 安全代理路由：
// 仅允许白名单域名通过，避免前端可被用于任意开放代理。
const express = require('express');
const router = express.Router();
const { fetch, UA } = require('../services/fetch');
const { cGet, cSet } = require('../services/cache');

// 从环境变量读取白名单，格式示例：PROXY_ALLOWED_DOMAINS=api.binance.com,fapi.binance.com
// 未配置时保留空数组，表示默认拒绝（更安全）。
const ALLOWED = (process.env.PROXY_ALLOWED_DOMAINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

/**
 * 将 u 参数规范为「绝对 URL」。
 * - 完整 URL（https://...）直接使用；
 * - 仅路径（如 /futures/data/...）时按 Binance 常见前缀补全基址，避免 new URL(path) 抛错导致 502。
 */
function normalizeProxyUrl(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    return new URL(s);
  } catch {
    if (!s.startsWith('/')) return null;
    // U 本位合约 / 期货数据接口
    if (s.startsWith('/fapi/') || s.startsWith('/futures/')) {
      return new URL(s, 'https://fapi.binance.com');
    }
    // 现货 REST
    if (s.startsWith('/api/')) {
      return new URL(s, 'https://api.binance.com');
    }
    // 其它相对路径：默认按合约端处理（与 monitor.js 拼接 BINANCE_F 为空时的行为对齐）
    return new URL(s, 'https://fapi.binance.com');
  }
}

router.get('/proxy', async (req, res) => {
  try {
    // 前端把目标 URL 放在 u 参数里：/api/proxy?u=...
    const raw = req.query.u;
    if (!raw) return res.status(400).json({ error: 'missing u' });
    const parsed = normalizeProxyUrl(raw);
    if (!parsed) return res.status(400).json({ error: 'invalid u' });
    const target = parsed.toString();
    // 解析 host 进行白名单校验，防止被滥用为开放代理。
    const host = parsed.hostname;
    if (!ALLOWED.some(d => host === d || host.endsWith('.'+d)))
      return res.status(403).json({ error: 'domain not allowed' });
    // 直接以 URL 作为缓存 key，同一请求短时内可复用。
    const cached = cGet(target);
    if (cached) return res.json(cached);
    // 透传拉取目标资源，统一带 UA 降低部分站点拦截概率。
    const r = await fetch(target, { headers: { 'User-Agent': UA } });
    if (!r.ok) return res.status(r.status).json({ error: `HTTP ${r.status}` });
    const data = await r.json();
    // 代理结果缓存 30 秒，平衡实时性与外部请求压力。
    cSet(target, data, 30000);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
