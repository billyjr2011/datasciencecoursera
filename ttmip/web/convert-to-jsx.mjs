import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const apiJs = fs.readFileSync('js/api.js', 'utf8');

const between = (s, a, b) => {
  const i = s.indexOf(a) + a.length;
  const j = s.indexOf(b, i);
  return s.slice(i, j);
};

// 1) CSS
const css = between(html, '<style>', '</style>').trim();

// 2) Head font links
const linkMatches = [...html.matchAll(/<link[^>]*fonts\.googleapis[^>]*>/g)].map((m) => m[0]);

// 3) Body inner, minus <script> blocks; capture the big inline script
let body = between(html, '<body>', '</body>');
let inlineJs = '';
body = body
  .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, (full, inner) => {
    if (/\bsrc\s*=/.test(full)) return ''; // external (api.js) — handled separately
    inlineJs += inner + '\n';
    return '';
  })
  .trim();

const combinedJs = apiJs + '\n;' + inlineJs;
const S = (x) => JSON.stringify(x);

const tail = '\\n;try{ if (typeof init === "function") init(); }catch(e){ console.error(e); }';

const out = `/*
 * index.jsx — faithful React conversion of ttmip/web/index.html (TTMIP v8).
 *
 * Generated from the original single-file dashboard. The exact CSS and body
 * markup are preserved; the original imperative dashboard logic (and the API
 * client) run inside a useEffect after mount, so every chart, map, ticker, tab,
 * and the API hydration behave identically to index.html.
 *
 * Usage:
 *   import TTMIPIndex from './index.jsx';
 *   <TTMIPIndex />
 *
 * Notes:
 * - Mounts the original markup verbatim via dangerouslySetInnerHTML; the bundled
 *   script attaches all behaviour via getElementById (as in the source).
 * - Loads Google Fonts into <head> on mount.
 * - For a component-idiomatic React port instead, see ../web-react/.
 */
import { useEffect, useRef } from 'react';

const CSS = ${S(css)};
const BODY_HTML = ${S(body)};
const FONT_LINKS = ${S(linkMatches)};
const DASHBOARD_JS = ${S(combinedJs)};

export default function TTMIPIndex() {
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return; // guard React 18 StrictMode double-invoke
    mounted.current = true;

    // Inject fonts into <head>.
    FONT_LINKS.forEach((tag) => {
      const tmp = document.createElement('div');
      tmp.innerHTML = tag;
      const link = tmp.firstElementChild;
      if (link) document.head.appendChild(link);
    });

    // Run the original dashboard logic (+ API client) in global scope, then
    // invoke init() manually since DOMContentLoaded has already fired.
    const script = document.createElement('script');
    script.textContent = DASHBOARD_JS + ${S(tail)};
    document.body.appendChild(script);

    return () => { script.remove(); };
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: BODY_HTML }} />
    </>
  );
}
`;

fs.writeFileSync('index.jsx', out);
console.log('Wrote index.jsx');
console.log('css bytes:', css.length, '| body bytes:', body.length, '| js bytes:', combinedJs.length, '| font links:', linkMatches.length);
