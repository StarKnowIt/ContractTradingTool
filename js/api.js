// ── api ──────────────────────────────────────────────────────────────────

async function loadSymbolList() {
  try {
    const r = await fetch(`${API}/api/proxy?u=${encodeURIComponent('https://fapi.binance.com/fapi/v1/exchangeInfo')}`);
    if (!r.ok) return;
    const d = await r.json();
    const popular = ['BTC','ETH','BNB','SOL','XRP','DOGE','ADA','AVAX','LINK','DOT','LTC','MATIC','NEAR','ARB','OP'];
    window._allSymbols = (d.symbols || [])
      .filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT' && s.contractType === 'PERPETUAL')
      .map(s => ({ symbol: s.symbol, base: s.baseAsset }))
      .filter((s, i, arr) => arr.findIndex(x => x.symbol === s.symbol) === i)
      .sort((a, b) => {
        const ai = popular.indexOf(a.base), bi = popular.indexOf(b.base);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return a.base.localeCompare(b.base);
      });
  } catch(e) {
    // 실패 시 기본 목록 사용
    window._allSymbols = ['BTC','ETH','BNB','SOL','XRP','DOGE','ADA','AVAX','LINK','DOT','LTC','MATIC','NEAR','ARB','OP']
      .map(b => ({ symbol: b+'USDT', base: b }));
  }
}

function renderSymbolDropdown(items) {
  const dd = document.getElementById('symbolDropdown');
  if (!dd) return;
  const current = document.getElementById('symbolSelect').value;
  if (!items.length) {
    dd.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:var(--text-muted);">无匹配结果</div>';
    return;
  }
  dd.innerHTML = items.slice(0, 80).map(s => `
    <div class="symbol-dropdown-item ${s.symbol === current ? 'active' : ''}"
         onmousedown="selectSymbol('${s.symbol}','${s.base}')">
      <span class="sym-name">${s.base}</span>
      <span style="color:var(--text-muted);font-size:11px;">/USDT</span>
    </div>
  `).join('');
}

function openSymbolDropdown() {
  const inp = document.getElementById('symbolInput');
  if (!inp) return;
  // dropdown을 body로 이동시켜 header stacking context 탈출
  let dd = document.getElementById('symbolDropdown');
  if (dd && dd.parentElement !== document.body) {
    document.body.appendChild(dd);
  }
  if (!dd) return;
  window._symbolDropdownOpen = true;
  inp.value = '';
  inp.placeholder = '搜索币种...';
  const rect = inp.getBoundingClientRect();
  dd.style.position = 'fixed';
  dd.style.top = (rect.bottom + 4) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.zIndex = '999999';
  dd.style.display = 'block';
  renderSymbolDropdown(window._allSymbols);
}

function filterSymbols(val) {
  const dd = document.getElementById('symbolDropdown');
  if (!dd) return;
  window._symbolDropdownOpen = true;
  dd.style.display = 'block';
  const q = val.toUpperCase().replace('/','').replace('-','').replace(' ','');
  const filtered = !q ? window._allSymbols : window._allSymbols.filter(s =>
    s.base.startsWith(q) || s.symbol.startsWith(q)
  );
  renderSymbolDropdown(filtered);
}

function selectSymbol(symbol, base) {
  // 유효한 심볼인지 체크
  if (!symbol || symbol.trim() === '') return;
  document.getElementById('symbolSelect').value = symbol;
  const inp = document.getElementById('symbolInput');
  inp.value = base + '/USDT';
  inp.placeholder = base + '/USDT';
  closeSymbolDropdown();
  loadAll();
}

function closeSymbolDropdown() {
  window._symbolDropdownOpen = false;
  const dd = document.getElementById('symbolDropdown');
  const inp = document.getElementById('symbolInput');
  if (!dd || !inp) return;
  dd.style.display = 'none';
  const sym = document.getElementById('symbolSelect').value;
  const base = sym.replace('USDT','');
  inp.value = base + '/USDT';
  inp.placeholder = base + '/USDT';
}

async function getKlines(symbol, interval, limit=300) {
  const r = await fetchTimeout(`${API}/api/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, 10000);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function getTicker(symbol) {
  if (!symbol || symbol.trim() === '') return null;
  const r = await fetchTimeout(`${API}/api/ticker?symbol=${encodeURIComponent(symbol)}`, 10000);
  if (!r.ok) return null;
  return r.json();
}

async function getFundingRate(symbol) {
  try {
    const r = await fetchTimeout(`${API}/api/funding?symbol=${symbol}`, 10000);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function getOpenInterest(symbol) {
  try {
    const r = await fetchTimeout(`${API}/api/oi?symbol=${symbol}`, 10000);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function getTopLSRatio(symbol) {
  try {
    return fetchTimeout(`${API}/api/proxy?u=${encodeURIComponent(`https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=5m&limit=1`)}`, 10000).then(r=>r.ok?r.json():null);
  } catch { return null; }
}

async function getGlobalLSRatio(symbol) {
  try {
    const r = await fetchTimeout(`${API}/api/ls?symbol=${symbol}`, 10000);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function getFearGreed() {
  try {
    const r = await fetchTimeout(`${API}/api/fg`, 10000);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function getForceOrders(symbol) {
  try {
    const r = await fetchTimeout(`${API}/api/force?symbol=${symbol}`, 10000);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function getOrderBook(symbol, limit=20) {
  try {
    const r = await fetchTimeout(`${API}/api/depth?symbol=${symbol}&limit=${limit}`, 10000);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function getCGCommunity(coin) {
  // 중문 또는 특수문자 코인은 CoinGecko 스킵
  if (!coin || !/^[a-zA-Z0-9]+$/.test(coin)) return null;
  const cacheKey = 'cg_' + coin;
  const cached = _cgCache[cacheKey];
  if (cached && Date.now() - cached.ts < 300000) return cached.data;
  try {
    const r = await fetchTimeout(`${API}/api/cg?coin=${coin.toLowerCase()}`, 10000);
    if (!r.ok) return null;
    const result = await r.json();
    _cgCache[cacheKey] = { data: result, ts: Date.now() };
    return result;
  } catch { return null; }
}

async function getOnchainTrades(coin) {
  const poolMap = {
    BTC:  'eth_0xcbcdf9626bc03e24f779434178a73a0b4bad62ed', // WBTC/ETH Uniswap
    ETH:  'eth_0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8', // ETH/USDC Uniswap
    SOL:  null,
    MATIC:'eth_0x99ac8ca7087fa4a2a1fb6357269965a2014adc58', // MATIC/USDC
  };
  const pool = poolMap[coin];
  if (!pool) return null;
  try {
    const [net, addr] = pool.split('_');
    return await fetchJSON(`https://api.geckoterminal.com/api/v2/networks/${net}/pools/${addr}/trades?trade_volume_in_usd_greater_than=100000`);
  } catch { return null; }
}

async function getTrendingCoins() {
  if (_trendingCache && Date.now() - _trendingTs < 300000) return _trendingCache;
  try {
    const r = await fetchTimeout(`${API}/api/trending`, 10000);
    if (!r.ok) return null;
    const data = await r.json();
    _trendingCache = data; _trendingTs = Date.now();
    return data;
  } catch { return null; }
}

async function getGlobalMarket() {
  if (_globalCache && Date.now() - _globalTs < 300000) return _globalCache;
  try {
    const r = await fetchTimeout(`${API}/api/global`, 10000);
    if (!r.ok) return null;
    const data = await r.json();
    _globalCache = data; _globalTs = Date.now();
    return data;
  } catch { return null; }
}

async function getAggTrades(symbol, limit=50) {
  try {
    const r = await fetchTimeout(`${API}/api/proxy?u=${encodeURIComponent(`https://api.binance.com/api/v3/aggTrades?symbol=${symbol}&limit=${limit}`)}`, 10000);
    return r.ok ? r.json() : [];
  } catch { return []; }
}

async function getBinanceAnnouncements(coin) {
  // Binance 官网国内不可直连，跳过
  return null;
}

async function getNewsCV(coin, interval) {
  const hoursMap = { '15m':1, '1h':6, '4h':24, '1d':168 };
  const hours = hoursMap[interval] || 6;
  try {
    const data = await fetchJSON(`https://cryptocurrency.cv/api/news?ticker=${coin}&limit=20`);
    const cutoff = Date.now() - hours * 3600000;
    const items  = (data.articles || data || []).filter(a => {
      const t = a.published_at || a.publishedAt || a.date || a.time;
      return !t || new Date(t).getTime() > cutoff;
    });
    return { results: items.slice(0, 15), source: 'CryptoCV', hours };
  } catch { return null; }
}

async function getNewsPanic(coin, interval) {
  const hoursMap = { '15m':1, '1h':6, '4h':24, '1d':168 };
  const hours = hoursMap[interval] || 6;
  try {
    const coinSlug = coin.toLowerCase();
    const data = await fetchJSON(`https://cryptopanic.com/api/free/v1/posts/?auth_token=free&currencies=${coin}&kind=news&public=true`);
    const cutoff = Date.now() - hours * 3600000;
    const items = (data.results || []).filter(r => new Date(r.published_at).getTime() > cutoff);
    return { results: items.slice(0, 12), source: 'CryptoPanic', hours };
  } catch { return null; }
}

async function getNewsAlternative() {
  try {
    const data = await fetchJSON('https://api.alternative.me/v1/ticker/?limit=1&convert=USD'); // via Worker
    return data;
  } catch { return null; }
}


// ── 消息面数据 ────────────────────────────────────────────────────────────────
async function getNewsForSentiment(coin = 'BTC') {
  // CryptoPanic 公开API（无需key）
  const url = `https://cryptopanic.com/api/v1/posts/?auth_token=free&currencies=${coin}&public=true&kind=news`;
  try {
    const r = await fetch(`${API}/api/proxy?u=${encodeURIComponent(url)}`);
    if (!r.ok) throw new Error('news fetch failed');
    const d = await r.json();
    return d.results || [];
  } catch(e) {
    // fallback: alternative.me news
    try {
      const r2 = await fetch(`${API}/api/proxy?u=${encodeURIComponent('https://api.alternative.me/v3/news/?limit=20')}`);
      const d2 = await r2.json();
      return (d2.data || []).map(n => ({
        title: n.title,
        url: n.url,
        published_at: n.published_at,
        votes: { positive: 0, negative: 0, important: 0 },
        source: { title: n.source?.name || 'News' },
        _sentiment: 'neutral'
      }));
    } catch(e2) {
      return [];
    }
  }
}
