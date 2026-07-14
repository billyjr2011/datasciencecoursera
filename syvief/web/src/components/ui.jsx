import { useEffect, useState } from 'react';
import { SEVERITY, REVIEW } from '../lib/api.js';

export function Badge({ color, children }) {
  return <span className="badge" style={{ color }}>
    <span className="dot" />{children}</span>;
}

export const SeverityBadge = ({ level }) => {
  const s = SEVERITY[level] ?? SEVERITY[0];
  return <Badge color={s.color}>{s.label}</Badge>;
};

export const ReviewBadge = ({ status }) => {
  const s = REVIEW[status] ?? REVIEW.a_verifier;
  return <Badge color={s.color}>{s.label}</Badge>;
};

export function Kpi({ value, label, sub, accent }) {
  return (
    <div className="card kpi">
      <div className="v" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="l">{label}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

// Barre horizontale simple (proportion d'un total).
export function Bar({ value, max, color = 'var(--grn)' }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

export const Spinner = () => <div className="spinner">Chargement…</div>;
export const ErrorBox = ({ error }) =>
  <div className="err">Erreur : {String(error?.message || error)}</div>;

// Petit hook de récupération de données avec états.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let alive = true;
    setState({ loading: true, data: null, error: null });
    Promise.resolve(fn())
      .then((data) => alive && setState({ loading: false, data, error: null }))
      .catch((error) => alive && setState({ loading: false, data: null, error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
