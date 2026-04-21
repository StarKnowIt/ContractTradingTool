// 大盘：USDT 永续 ticker 表 + 多周期涨幅榜（CCXT / Binance USDM）
const express = require('express');
const {
  fetchFuturesTickerTable,
  fetchTopGainersMultiPeriod,
  DEFAULT_TIMEFRAMES,
} = require('../services/ccxtBoard');

const router = express.Router();

router.get('/futures-tickers', async (req, res) => {
  try {
    const data = await fetchFuturesTickerTable();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message || String(e) });
  }
});

router.get('/top-gainers', async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const tfRaw = (req.query.timeframes || '').trim();
    const timeframes = tfRaw
      ? tfRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : DEFAULT_TIMEFRAMES;
    const data = await fetchTopGainersMultiPeriod({ limit, timeframes });
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message || String(e) });
  }
});

module.exports = router;
