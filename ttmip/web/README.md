# TTMIP — static dashboard & converted JSX entry

This folder holds the original TTMIP v8 dashboard and its React conversion.

| File | What it is |
| --- | --- |
| `index.html` | The original standalone dashboard. Open directly in a browser, or serve via the API / nginx. No build step. |
| `js/api.js` | API client + offline fallback used by `index.html`. |
| `index.jsx` | Faithful React conversion of `index.html` (exact CSS + markup + logic). |
| `convert-to-jsx.mjs` | Reproducible generator for `index.jsx`. |
| `app.html` + `main.jsx` | Runnable Vite entry that mounts `index.jsx`. |

## Run the converted dashboard (index.jsx)

```bash
npm install
npm run dev      # → http://localhost:5174/app.html
```

`npm run dev` proxies `/api` → `http://localhost:4000`, so with the backend
running the dashboard hydrates **LIVE** data; otherwise it falls back to the
built-in **DEMO** data.

```bash
npm run build    # production build of app.html → dist-jsx/
npm run preview  # serve the build
```

## Original standalone dashboard (index.html)

No build needed — open `index.html` in a browser, or it is served at `/` by the
API (`server/`) and by the nginx image (`Dockerfile`).

> For an idiomatic, component-based React rewrite of all 15 modules, see
> [`../web-react/`](../web-react/).
