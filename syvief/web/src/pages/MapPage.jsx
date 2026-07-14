import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, SEVERITY } from '../lib/api.js';
import { useAsync, Spinner, ErrorBox } from '../components/ui.jsx';
import UcDrawer from '../components/UcDrawer.jsx';

const CELL_W = 1000; // largeur d'une UC (E–O) en mètres
const CELL_H = 250;  // hauteur d'une UC (N–S) en mètres → 25 ha

// Carte GIS : chaque UC est un carré de 500 m coloré selon sa sévérité.
export default function MapPage() {
  const nav = useNavigate();
  const cvRef = useRef(null);
  const [sel, setSel] = useState(null);
  const [hover, setHover] = useState(null);
  const [refresh, setRefresh] = useState(0);

  const { loading, data, error } = useAsync(
    () => Promise.all([api.meta(), api.ucs({ limit: 500 })]), [refresh]);

  useEffect(() => {
    if (!data) return;
    const [meta, ucs] = data;
    const ext = meta.extent;
    const cv = cvRef.current;
    const W = cv.width, H = cv.height, pad = 20;
    const sx = (W - 2 * pad) / (ext.X1 - ext.X0);
    const sy = (H - 2 * pad) / (ext.Y1 - ext.Y0);
    const s = Math.min(sx, sy);
    // world → screen (nord vers le haut)
    const px = (x) => pad + (x - ext.X0) * s;
    const py = (y) => H - pad - (y - ext.Y0) * s;

    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#02150a';
    ctx.fillRect(0, 0, W, H);

    for (const u of ucs.items) {
      const x = px(u.x_utm), y = py(u.y_utm + CELL_H);
      const w = CELL_W * s, h = CELL_H * s;
      const c = SEVERITY[u.severity]?.color || '#5fb84a';
      ctx.fillStyle = c + '30';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = (hover && hover.uc_id === u.uc_id) ? '#fff' : c;
      ctx.lineWidth = (hover && hover.uc_id === u.uc_id) ? 2 : 1;
      ctx.strokeRect(x, y, w, h);
    }
    cv._ucs = ucs.items.map((u) => ({
      ...u, _x: px(u.x_utm), _y: py(u.y_utm + CELL_H), _w: CELL_W * s, _h: CELL_H * s,
    }));
  }, [data, hover]);

  function pick(e) {
    const cv = cvRef.current;
    const r = cv.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (cv.width / r.width);
    const my = (e.clientY - r.top) * (cv.height / r.height);
    return (cv._ucs || []).find((u) =>
      mx >= u._x && mx <= u._x + u._w && my >= u._y && my <= u._y + u._h);
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Carte GIS de la concession</h2>
          <p>{data[0].crs} — UC de 1000 m × 250 m (25 ha). Cliquez une UC pour ouvrir son dossier.</p>
        </div>
      </div>
      <div className="legend" style={{ marginBottom: 12 }}>
        {Object.entries(SEVERITY).map(([k, v]) =>
          <span key={k}><i className="chip" style={{ background: v.color }} />{v.label}</span>)}
      </div>
      <div className="card" style={{ position: 'relative' }}>
        <canvas ref={cvRef} width={760} height={620}
          style={{ maxWidth: '100%' }}
          onMouseMove={(e) => setHover(pick(e) || null)}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => { const u = pick(e); if (u) setSel(u.uc_id); }} />
        {hover && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--elv)',
            border: '1px solid var(--bdr)', borderRadius: 9, padding: '8px 12px' }}>
            <b>{hover.uc_id}</b> · {hover.suspect_rate_pct}% ·{' '}
            <span style={{ color: SEVERITY[hover.severity]?.color }}>
              {SEVERITY[hover.severity]?.label}</span>
          </div>
        )}
      </div>
      {sel && <UcDrawer id={sel} onClose={() => setSel(null)}
        onChange={() => setRefresh((n) => n + 1)} />}
    </>
  );
}
