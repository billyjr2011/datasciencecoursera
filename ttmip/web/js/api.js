/*
 * TTMIP API client + hydration layer.
 *
 * This is the single network boundary for the dashboard. It exposes a small
 * typed-ish client (`TTMIP.api.*`) and a `TTMIP.hydrate()` helper that loads the
 * dynamic datasets from the backend at startup.
 *
 * Design goal: the API returns the SAME shapes the dashboard already renders, so
 * hydration is a straight assignment — no rendering rewrite. If the API is
 * unreachable (offline demo, outage), `hydrate()` resolves to `null` and the UI
 * falls back to its built-in deterministic generators.
 */
(function () {
  // Same-origin by default (the API also serves this file). Override by setting
  // window.TTMIP_API_BASE before this script loads (e.g. a separate API host).
  var BASE = (window.TTMIP_API_BASE || '') + '/api/v1';

  async function get(path, params) {
    var url = BASE + path;
    if (params) {
      var qs = Object.entries(params)
        .filter(function (e) { return e[1] != null && e[1] !== ''; })
        .map(function (e) { return encodeURIComponent(e[0]) + '=' + encodeURIComponent(e[1]); })
        .join('&');
      if (qs) url += '?' + qs;
    }
    var res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('API ' + res.status + ' for ' + path);
    var body = await res.json();
    return body.data;
  }

  var api = {
    dashboard: function () { return get('/dashboard/summary'); },
    species: function () { return get('/reference/species'); },
    markets: function () { return get('/reference/markets'); },
    prices: function (filters) { return get('/prices', filters); },
    indices: function () { return get('/indices'); },
    index: function (code) { return get('/indices/' + code); },
    esg: function () { return get('/esg'); },
    certificates: function (filters) { return get('/certificates', filters); },
    alerts: function (filters) { return get('/alerts', filters); },
    ddra: function (filters) { return get('/ddra', filters); },
    regulations: function (filters) { return get('/regulations', filters); },
  };

  /**
   * Loads the dynamic datasets in parallel and normalizes them to the exact
   * shapes the dashboard's render functions expect. Returns `null` on any
   * failure so callers can fall back cleanly.
   */
  async function hydrate() {
    try {
      var results = await Promise.all([
        api.prices({ limit: 200 }),
        api.alerts({ limit: 30 }),
        api.esg(),
        api.certificates(),
        api.ddra(),
      ]);
      var prices = results[0].map(function (p) {
        return {
          id: p.id, platform: p.platform, species: p.species,
          destination: p.destination, destName: p.destName,
          price: p.price, volume: p.volume, quality: p.quality,
          ts: new Date(p.ts),
        };
      });
      return { prices: prices, alerts: results[1], esg: results[2], certs: results[3], ddra: results[4] };
    } catch (err) {
      console.warn('[TTMIP] API hydrate failed — using built-in demo data.', err);
      return null;
    }
  }

  /** Reflects live vs demo state in the topbar live badge. */
  function setMode(mode) {
    var live = document.querySelector('.live-badge');
    if (!live) return;
    if (mode === 'LIVE') {
      live.title = 'Connected to TTMIP API';
    } else {
      live.title = 'Offline demo data (API unreachable)';
      live.style.borderColor = 'rgba(244,162,51,0.3)';
      var dot = live.querySelector('.live-dot');
      if (dot) dot.style.background = 'var(--accent2)';
    }
  }

  window.TTMIP = { api: api, hydrate: hydrate, setMode: setMode };
})();
