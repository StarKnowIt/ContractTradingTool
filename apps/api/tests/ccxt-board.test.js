const test = require('node:test');
const assert = require('node:assert/strict');
const { pctSincePrevBarClose } = require('../services/ccxtBoard');

test('pctSincePrevBarClose uses previous bar close vs last', () => {
  const ohlcv = [
    [0, 10, 11, 9, 10, 100],
    [1, 10, 12, 9.5, 11, 200],
  ];
  const pct = pctSincePrevBarClose(ohlcv, 11);
  assert.ok(pct != null);
  assert.equal(Number(pct.toFixed(4)), 10);
});

test('pctSincePrevBarClose single row falls back', () => {
  const ohlcv = [[0, 100, 110, 90, 105, 1]];
  const pct = pctSincePrevBarClose(ohlcv, 110);
  assert.ok(pct != null);
  assert.equal(Number(pct.toFixed(4)), Number((((110 - 105) / 105) * 100).toFixed(4)));
});
