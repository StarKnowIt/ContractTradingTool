const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { mountRouteWithMockedFetchService } = require('./helpers/route-test-utils');

function buildProxyApp({ allowedDomains = 'api.binance.com', fakeFetch }) {
  return mountRouteWithMockedFetchService({
    routeModulePath: require.resolve('../routes/proxy'),
    fetchServiceExports: { fetch: fakeFetch, UA: 'test-ua' },
    env: { PROXY_ALLOWED_DOMAINS: allowedDomains }
  });
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

test('GET /api/proxy should resolve Binance-relative path u to fapi URL', async () => {
  let fetchedUrl = '';
  const ctx = buildProxyApp({
    allowedDomains: 'fapi.binance.com',
    fakeFetch: async (url) => {
      fetchedUrl = url;
      return { ok: true, async json() { return [{ longShortRatio: '1' }]; } };
    }
  });
  try {
    const rel = encodeURIComponent('/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1');
    const res = await request(ctx.app).get(`/api/proxy?u=${rel}`).expect(200);
    assert.equal(res.body[0].longShortRatio, '1');
    assert.ok(fetchedUrl.startsWith('https://fapi.binance.com/futures/data/'));
  } finally {
    ctx.restore();
  }
});

