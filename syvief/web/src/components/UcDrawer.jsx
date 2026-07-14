import { useState } from 'react';
import { api, REVIEW } from '../lib/api.js';
import { useAsync, Spinner, ErrorBox, SeverityBadge, ReviewBadge } from './ui.jsx';

const GRADE_COLOR = { OA: 'var(--red)', OB: 'var(--amb)', OC: 'var(--blu)' };

// Volet latéral : détail d'une UC + saisie d'une décision de contrôle.
export default function UcDrawer({ id, onClose, onChange }) {
  const [nonce, setNonce] = useState(0);
  const { loading, data: uc, error } = useAsync(() => api.uc(id), [id, nonce]);
  const hist = useAsync(() => api.ucVerifications(id), [id, nonce]);

  const [form, setForm] = useState({ status: 'en_cours', decision: '', note: '', inspector: '' });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setSaveErr(null);
    try {
      await api.verify(id, form);
      setForm((f) => ({ ...f, decision: '', note: '' }));
      setNonce((n) => n + 1);
      onChange?.();
    } catch (err) { setSaveErr(err); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`UC ${id}`}>
        <button className="x" onClick={onClose} aria-label="Fermer">×</button>
        {loading && <Spinner />}
        {error && <ErrorBox error={error} />}
        {uc && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>{uc.uc_id}</h2>
              <SeverityBadge level={uc.severity} />
              <ReviewBadge status={uc.review?.status} />
              {uc.edge_flag ? <span className="badge" style={{ color: 'var(--pur)' }}>
                <span className="dot" />Bordure</span> : null}
            </div>
            <p className="muted" style={{ marginTop: 4 }}>
              Bloc {uc.bloc} · UTM {uc.x_utm}, {uc.y_utm}
            </p>

            <div className="def">
              <div><span>Tiges inventoriées</span><b>{uc.trees_total}</b></div>
              <div><span>Taux d'anomalie</span><b>{uc.suspect_rate_pct}%</b></div>
              <div><span>Tiges suspectes</span><b>{uc.suspect_count}</b></div>
              <div><span>Retenues (tally)</span><b>{uc.tally}</b></div>
              <div><span>Qualité OA</span><b>{uc.grade_oa}</b></div>
              <div><span>DBH moyen</span><b>{uc.mean_dbh_cm ?? '–'} cm</b></div>
            </div>

            {uc.alerts?.length > 0 && (
              <div className="card" style={{ marginBottom: 14 }}>
                <h3>Alertes d'isolement</h3>
                {uc.alerts.map((a) => (
                  <div key={a.id} className="muted">
                    {a.species} — distance {a.distance_m} m
                  </div>
                ))}
              </div>
            )}

            <div className="card" style={{ marginBottom: 14 }}>
              <h3>Tiges irrégulières ({uc.trees.length})</h3>
              <div style={{ maxHeight: 220, overflow: 'auto' }}>
                <table>
                  <thead><tr><th>Étiquette</th><th>Espèce</th>
                    <th className="num">DBH</th><th>Qualité</th></tr></thead>
                  <tbody>
                    {uc.trees.map((t) => (
                      <tr key={t.id}>
                        <td>{t.tag_id}</td><td>{t.species}</td>
                        <td className="num">{t.dbh_cm}</td>
                        <td style={{ color: GRADE_COLOR[t.grade] || 'inherit' }}>{t.grade}</td>
                      </tr>
                    ))}
                    {uc.trees.length === 0 &&
                      <tr><td colSpan="4" className="muted">Aucune tige signalée.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <h3>Décision de contrôle</h3>
              <form onSubmit={submit}>
                <div className="field">
                  <label>Statut</label>
                  <select value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {Object.entries(REVIEW).map(([k, v]) =>
                      <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Inspecteur</label>
                  <input type="text" value={form.inspector} placeholder="Nom"
                    onChange={(e) => setForm({ ...form, inspector: e.target.value })} />
                </div>
                <div className="field">
                  <label>Conclusion</label>
                  <input type="text" value={form.decision} placeholder="Ex. Conforme après contrôle terrain"
                    onChange={(e) => setForm({ ...form, decision: e.target.value })} />
                </div>
                <div className="field">
                  <label>Note</label>
                  <textarea value={form.note} placeholder="Observations…"
                    onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </div>
                {saveErr && <ErrorBox error={saveErr} />}
                <button className="btn" disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer la décision'}
                </button>
              </form>
            </div>

            <div className="card">
              <h3>Historique</h3>
              {hist.loading && <Spinner />}
              <div className="timeline">
                {(hist.data || []).map((v) => (
                  <div className="ev" key={v.id}>
                    <div><ReviewBadge status={v.status} /> {v.decision || ''}</div>
                    {v.note && <div className="muted">{v.note}</div>}
                    <small>{v.inspector} · {v.created_at}</small>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
