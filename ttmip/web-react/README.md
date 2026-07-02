# TTMIP — React + Vite app

A full, runnable React port of the TTMIP dashboard. All **15 modules** are
implemented and the SVG **Cameroon deforestation map** plots live alerts.

## Modules

| Tab | Content |
| --- | --- |
| Dashboard | KPIs, top-markets bar chart, alert map + counts, latest prices |
| Market Prices | searchable / quality-filtered price table |
| Int'l Markets | sortable market performance (volume / price / growth) |
| Price Indices | GSPI & ESPI SVG line charts |
| ESG Scores | per-company SVG gauges + sortable score table |
| Certificates | FSC / PEFC / expiring filters |
| Forest Alerts | interactive Cameroon map + alert records |
| Due Diligence | EUDR DDRA records, status filter |
| Regulatory | EUDR / EUTR / FLEGT / Lacey / CITES with price-impact |
| Trading Desk | candle chart, partner brokers, working order ticket |
| Technical | candles + RSI / SMA / MACD / Bollinger indicators |
| Publications | data-source cards + article feed |
| Fundamentals | supply / demand fundamentals + macro indicators |
| FAQ | categorised accordion |
| AI Intelligence | generated insights + market-sentiment feed |

## Run

```bash
npm install
npm run dev      # http://localhost:5173  (proxies /api → http://localhost:4000)
npm run build    # production bundle in dist/
npm run preview  # serve the build
```

The app hydrates `prices / alerts / esg / certs / ddra` from the TTMIP API on
load (**LIVE** badge). If the API is unreachable it falls back to deterministic
demo generators (**DEMO** badge), so it always renders.

Point at a non-local API with `<TTMIP apiBase="https://api.ttmip.cm" />` (in
`src/main.jsx`).

## Live demo (self-contained)

```bash
npm run build:demo     # → ../demo/index.html  (one self-contained file)
```

`npm run build:demo` inlines the entire app into a single
[`ttmip/demo/index.html`](../demo/index.html) (~198 KB). It has no external
dependencies (bar Google Fonts) and **needs no backend** — it runs on the
built-in demo data, so you can open it by double-clicking or host it anywhere
(GitHub Pages, Netlify drop, S3).

A GitHub Pages workflow (`.github/workflows/pages.yml` at the repo root)
publishes it automatically — enable Pages (Settings → Pages → Source: GitHub
Actions) and it goes live at `https://billyjr2011.github.io/datasciencecoursera/`.

## Structure

```
src/
  main.jsx        # React entry
  TTMIP.jsx       # shell: topbar, ticker, sidebar nav, data hook
  tabs.jsx        # all 15 tab pages
  components.jsx  # Badge, Card, Table, charts, gauges, CameroonMap, CandleChart
  data.js         # reference + content data, generators, API client
  theme.js        # design tokens
```
