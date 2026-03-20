const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

function buildMarketApp({ fetchJSONImpl, fetchImpl }) {
  const fetchServicePath = require.resolve('../services/fetch');
  const marketRoutePath = require.resolve('../routes/market');
  const oldFetchService = require.cache[fetchServicePath];
  delete require.cache[fetchServicePath];
  delete require.cache[marketRoutePath];

  require.cache[fetchServicePath] = {
    id: fetchServicePath,
    filename: fetchServicePath,
    loaded: true,
    exports: {
      fetchJSON: fetchJSONImpl,
      fetch: fetchImpl || (async () => ({ ok: false })),
      UA: 'test-ua'
    }
  };

  const app = express();
  app.use('/api', require('../routes/market'));

  return {
    app,
    restore() {
      delete require.cache[marketRoutePath];
      if (oldFetchService) require.cache[fetchServicePath] = oldFetchService;
      else delete require.cache[fetchServicePath];
    }
  };
}

test('GET /api/ticker should fallback to OKX when Binance fails', async () => {
  const fetchJSONImpl = async (url) => {
    if (url.includes('api.binance.com') || url.includes('api1.binance.com') || url.includes('api2.binance.com')) {
      throw new Error('binance down');
    }
    if (url.includes('okx.com/api/v5/market/ticker')) {
      return {
        data: [{
          last: '100',
          open24h: '80',
          high24h: '110',
          low24h: '70',
          volCcy24h: '12345',
          vol24h: '678'
        }]
      };
    }
    throw new Error('unexpected url');
  };

  const ctx = buildMarketApp({ fetchJSONImpl });
  try {
    const res = await request(ctx.app).get('/api/ticker?symbol=BTCUSDT').expect(200);
    assert.equal(res.body.symbol, 'BTCUSDT');
    assert.equal(res.body.lastPrice, '100');
    assert.equal(res.body.priceChangePercent, '25.00');
  } finally {
    ctx.restore();
  }
});

test('GET /api/depth should return empty depth when all upstream fail', async () => {
  const fetchJSONImpl = async () => ({});
  const fetchImpl = async () => ({ ok: false });

  const ctx = buildMarketApp({ fetchJSONImpl, fetchImpl });
  try {
    const res = await request(ctx.app).get('/api/depth?symbol=BTCUSDT&limit=20').expect(200);
    assert.deepEqual(res.body, { bids: [], asks: [] });
  } finally {
    ctx.restore();
  }
});

