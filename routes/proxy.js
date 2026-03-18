const express = require('express');
const router = express.Router();
const { fetch, UA } = require('../services/fetch');
const { cGet, cSet } = require('../services/cache');

const ALLOWED = ['api.binance.com','fapi.binance.com','api.coingecko.com','api.alternative.me','api.geckoterminal.com','cryptopanic.com'];

router.get('/proxy', async (req, res) => {
  try {
    const target = req.query.u;
    if (!target) return res.status(400).json({ error: 'missing u' });
    const host = new URL(target).hostname;
    if (!ALLOWED.some(d => host === d || host.endsWith('.'+d)))
      return res.status(403).json({ error: 'domain not allowed' });
    const cached = cGet(target);
    if (cached) return res.json(cached);
    const r = await fetch(target, { headers: { 'User-Agent': UA } });
    if (!r.ok) return res.status(r.status).json({ error: `HTTP ${r.status}` });
    const data = await r.json();
    cSet(target, data, 30000);
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
