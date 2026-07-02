# TTMIP — React / JSX (standalone single file)

> Looking for the **full runnable app** with all 15 modules and the Cameroon
> alert map? See [`../../web-react/`](../../web-react/). This folder is the
> dependency-free, single-file component for dropping into an existing project.

`TTMIP.jsx` is a single-file React port of the TTMIP dashboard. It has **no
dependencies beyond React** (charts are inline SVG/CSS) and renders the
data-driven modules: Dashboard, Prices, Markets, Indices, ESG, Certificates,
Alerts, Due Diligence, and Regulatory. The remaining tabs are scaffolded.

## Usage

```jsx
import TTMIP from './TTMIP.jsx';

export default function App() {
  return <TTMIP />;                      // same-origin API at /api/v1
  // return <TTMIP apiBase="https://api.ttmip.cm" />;   // explicit API host
}
```

It hydrates `prices / alerts / esg / certs / ddra` from the TTMIP API on mount
and shows a **LIVE** badge; if the API is unreachable it falls back to the
built-in deterministic generators and shows **DEMO**, so the UI always works.

## Quick scaffold (Vite)

```bash
npm create vite@latest ttmip-ui -- --template react
cd ttmip-ui && npm install
cp /path/to/TTMIP.jsx src/
# edit src/App.jsx → import TTMIP from './TTMIP.jsx'; export default () => <TTMIP/>;
npm run dev
```

Verified to compile with `esbuild` (JSX → ESM, ~40 KB bundle).
