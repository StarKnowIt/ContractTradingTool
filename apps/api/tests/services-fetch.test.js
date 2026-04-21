const test = require('node:test');
const assert = require('node:assert/strict');

test('fetchJSON should return cached data on second call', async () => {
  const calls = [];
  const fakeFetch = async () => {
    calls.push(Date.now());
    return {
      ok: true,
      status: 200,
      async json() {
        return { value: 42 };
      }
    };
  };

  const nodeFetchPath = require.resolve('node-fetch');
  const fetchModulePath = require.resolve('../services/fetch');
  const oldNodeFetch = require.cache[nodeFetchPath];
  delete require.cache[fetchModulePath];
  require.cache[nodeFetchPath] = {
    id: nodeFetchPath,
    filename: nodeFetchPath,
    loaded: true,
    exports: fakeFetch
  };

  try {
    const { fetchJSON } = require('../services/fetch');
    const a = await fetchJSON('https://unit.test/fetch/cache', 1000);
    const b = await fetchJSON('https://unit.test/fetch/cache', 1000);
    assert.deepEqual(a, { value: 42 });
    assert.deepEqual(b, { value: 42 });
    assert.equal(calls.length, 1);
  } finally {
    delete require.cache[fetchModulePath];
    if (oldNodeFetch) require.cache[nodeFetchPath] = oldNodeFetch;
    else delete require.cache[nodeFetchPath];
  }
});

test('fetchJSON should throw when upstream response is not ok', async () => {
  const prevRetries = process.env.FETCH_MAX_RETRIES;
  process.env.FETCH_MAX_RETRIES = '0';
  const fakeFetch = async () => ({ ok: false, status: 503 });
  const nodeFetchPath = require.resolve('node-fetch');
  const fetchModulePath = require.resolve('../services/fetch');
  const oldNodeFetch = require.cache[nodeFetchPath];
  delete require.cache[fetchModulePath];
  require.cache[nodeFetchPath] = {
    id: nodeFetchPath,
    filename: nodeFetchPath,
    loaded: true,
    exports: fakeFetch
  };

  try {
    const { fetchJSON } = require('../services/fetch');
    await assert.rejects(
      () => fetchJSON('https://unit.test/fetch/error', 1000),
      /HTTP 503/
    );
  } finally {
    if (prevRetries === undefined) delete process.env.FETCH_MAX_RETRIES;
    else process.env.FETCH_MAX_RETRIES = prevRetries;
    delete require.cache[fetchModulePath];
    if (oldNodeFetch) require.cache[nodeFetchPath] = oldNodeFetch;
    else delete require.cache[nodeFetchPath];
  }
});

test('fetchJSON should succeed after retryable HTTP status then ok', async () => {
  const prevRetries = process.env.FETCH_MAX_RETRIES;
  process.env.FETCH_MAX_RETRIES = '2';
  let n = 0;
  const fakeFetch = async () => {
    n++;
    if (n === 1) return { ok: false, status: 503 };
    return {
      ok: true,
      status: 200,
      async json() {
        return { value: 7 };
      }
    };
  };
  const nodeFetchPath = require.resolve('node-fetch');
  const fetchModulePath = require.resolve('../services/fetch');
  const oldNodeFetch = require.cache[nodeFetchPath];
  delete require.cache[fetchModulePath];
  require.cache[nodeFetchPath] = {
    id: nodeFetchPath,
    filename: nodeFetchPath,
    loaded: true,
    exports: fakeFetch
  };

  try {
    const { fetchJSON } = require('../services/fetch');
    const data = await fetchJSON('https://unit.test/fetch/retry-ok', 500);
    assert.deepEqual(data, { value: 7 });
    assert.equal(n, 2);
  } finally {
    if (prevRetries === undefined) delete process.env.FETCH_MAX_RETRIES;
    else process.env.FETCH_MAX_RETRIES = prevRetries;
    delete require.cache[fetchModulePath];
    if (oldNodeFetch) require.cache[nodeFetchPath] = oldNodeFetch;
    else delete require.cache[nodeFetchPath];
  }
});

