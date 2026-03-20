const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

function buildProxyApp({ allowedDomains = 'api.binance.com', fakeFetch }) {
  process.env.PROXY_ALLOWED_DOMAINS = allowedDomains;

  const fetchServicePath = require.resolve('../services/fetch');
  const proxyRoutePath = require.resolve('../routes/proxy');
  const oldFetchService = require.cache[fetchServicePath];
  delete require.cache[fetchServicePath];
  delete require.cache[proxyRoutePath];

  require.cache[fetchServicePath] = {
    id: fetchServicePath,
    filename: fetchServicePath,
    loaded: true,
    exports: { fetch: fakeFetch, UA: 'test-ua' }
  };

  const app = express();
  app.use('/api', require('../routes/proxy'));

  return {
    app,
    restore() {
      delete require.cache[proxyRoutePath];
      if (oldFetchService) require.cache[fetchServicePath] = oldFetchService;
      else delete require.cache[fetchServicePath];
      delete process.env.PROXY_ALLOWED_DOMAINS;
    }
  };
}

test('GET /api/proxy should return 400 when u is missing', async () => {
  const ctx = buildProxyApp({
    fakeFetch: async () => ({ ok: true, async json() { return {}; } })
  });
  try {
    const res = await request(ctx.app).get('/api/proxy').expect(400);
    assert.equal(res.body.error, 'missing u');
  } finally {
    ctx.restore();
  }
});

test('GET /api/proxy should block non-whitelisted domains', async () => {
  const ctx = buildProxyApp({
    allowedDomains: 'api.binance.com',
    fakeFetch: async () => ({ ok: true, async json() { return {}; } })
  });
  try {
    const target = encodeURIComponent('https://evil.test/path');
    const res = await request(ctx.app).get(`/api/proxy?u=${target}`).expect(403);
    assert.equal(res.body.error, 'domain not allowed');
  } finally {
    ctx.restore();
  }
});

