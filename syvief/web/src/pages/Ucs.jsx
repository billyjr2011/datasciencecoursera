import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, REVIEW, SEVERITY } from '../lib/api.js';
import { useAsync, Spinner, ErrorBox, SeverityBadge, ReviewBadge } from '../components/ui.jsx';
import UcDrawer from '../components/UcDrawer.jsx';

export default function Ucs() {
  const nav = useNavigate();
  const { id } = useParams();
  const [f, setF] = useState({ bloc: '', severity: '', status: '', q: '' });
  const [refresh, setRefresh] = useState(0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const blocs = useAsync(() => api.blocs(), []);
  const { loading, data, error } = useAsync(
    () => api.ucs({ ...f, limit: 200 }),
    [f.bloc, f.severity, f.status, f.q, refresh]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Unités de comptage</h2>
          <p>Contrôle cellule par cellule de l'inventaire d'exploitation.</p>
        </div>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="Rechercher une UC…" value={f.q} onChange={set('q')} />
        <select value={f.bloc} onChange={set('bloc')}>
          <option value="">Tous les blocs</option>
          {(blocs.data || []).map((b) => <option key={b.bloc} value={b.bloc}>{b.bloc}</option>)}
        </select>
        <select value={f.severity} onChange={set('severity')}>
          <option value="">Toutes sévérités</option>
          {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={f.status} onChange={set('status')}>
          <option value="">Tous statuts</option>
          {Object.entries(REVIEW).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading && <Spinner />}
      {error && <ErrorBox error={error} />}
      {data && (
        <div className="card">
          <div className="muted" style={{ marginBottom: 8 }}>
            {data.total} UC{data.total > 1 ? 's' : ''}
            {data.total > data.items.length ? ` (${data.items.length} affichées)` : ''}
          </div>
          <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
            <table>
              <thead><tr>
                <th>UC</th><th>Bloc</th><th className="num">Taux</th>
                <th className="num">Suspectes</th><th className="num">Tiges</th>
                <th className="num">DBH</th><th>Sévérité</th><th>Contrôle</th>
              </tr></thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.uc_id} className="rowlink" onClick={() => nav(`/ucs/${u.uc_id}`)}>
                    <td><b>{u.uc_id}</b></td>
                    <td>{u.bloc}</td>
                    <td className="num">{u.suspect_rate_pct}%</td>
                    <td className="num">{u.suspect_count}</td>
                    <td className="num">{u.trees_total}</td>
                    <td className="num">{u.mean_dbh_cm ?? '–'}</td>
                    <td><SeverityBadge level={u.severity} /></td>
                    <td><ReviewBadge status={u.review_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {id && (
        <UcDrawer id={id} onClose={() => nav('/ucs')}
          onChange={() => setRefresh((n) => n + 1)} />
      )}
    </>
  );
}
