import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, CONFORMITY } from '../lib/api.js';
import { useAsync, Spinner, ErrorBox, Kpi, Bar, Badge } from '../components/ui.jsx';

function Simulator() {
  const [f, setF] = useState({
    region: 'Est', trees_total: 60, mean_dbh_cm: 105,
    grade_oa: 9, suspect_rate_pct: 4, tally: 59, edge_flag: 0,
  });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const num = (k) => (e) => setF({ ...f, [k]: Number(e.target.value) });

  async function run(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { setRes(await api.mlScore(f)); }
    catch (x) { setErr(x); } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <h3>Simulateur de conformité</h3>
      <p className="muted" style={{ marginTop: -6 }}>
        Soumettez une UC hypothétique (25 ha) au réseau et lisez sa similarité au
        profil certifié régional.
      </p>
      <form onSubmit={run}>
        <div className="def" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label className="field"><span className="muted">Région</span>
            <select value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>
              {['Sud', 'Centre', 'Est', 'Littoral'].map((r) => <option key={r}>{r}</option>)}
            </select></label>
          <label className="field"><span className="muted">Tiges inventoriées</span>
            <input type="number" value={f.trees_total} onChange={num('trees_total')} /></label>
          <label className="field"><span className="muted">DBH moyen (cm)</span>
            <input type="number" value={f.mean_dbh_cm} onChange={num('mean_dbh_cm')} /></label>
          <label className="field"><span className="muted">Tiges qualité OA</span>
            <input type="number" value={f.grade_oa} onChange={num('grade_oa')} /></label>
          <label className="field"><span className="muted">Taux d'anomalie (%)</span>
            <input type="number" step="0.1" value={f.suspect_rate_pct} onChange={num('suspect_rate_pct')} /></label>
          <label className="field"><span className="muted">Tiges retenues (tally)</span>
            <input type="number" value={f.tally} onChange={num('tally')} /></label>
        </div>
        {err && <ErrorBox error={err} />}
        <button className="btn" disabled={busy}>{busy ? 'Calcul…' : 'Évaluer'}</button>
      </form>
      {res && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 30, fontWeight: 700,
              color: CONFORMITY[res.level]?.color }}>{res.conformity}%</div>
            <div>
              <Badge color={CONFORMITY[res.level]?.color}>{CONFORMITY[res.level]?.label}</Badge>
              <div className="muted" style={{ marginTop: 4 }}>{res.label}</div>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <Bar value={res.conformity} max={100} color={CONFORMITY[res.level]?.color} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Model() {
  const { loading, data, error } = useAsync(() =>
    Promise.all([api.mlModel(), api.mlRegions(), api.mlScan().catch(() => null)]));
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const [model, regions, scan] = data;

  if (!model.trained) {
    return (
      <>
        <div className="page-head"><div><h2>Modèle IA</h2></div></div>
        <div className="card">
          <p>Le réseau n'est pas encore entraîné.</p>
          <p className="muted">Lancez <code>npm run train</code> côté serveur pour
            entraîner le modèle sur le jeu de référence des 4 régions.</p>
        </div>
      </>
    );
  }

  const m = model.metrics.test;
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Modèle de conformité (réseau de neurones)</h2>
          <p>Apprend la signature des inventaires de sociétés certifiées sur les
            quatre régions forestières du Cameroun.</p>
        </div>
      </div>

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <Kpi value={`${(m.acc * 100).toFixed(1)}%`} label="Exactitude (test)" accent="var(--grn)" />
        <Kpi value={m.f1.toFixed(3)} label="Score F1 (test)" />
        <Kpi value={model.training.samples} label="UC de référence"
          sub={`${model.training.train} entraînement / ${model.training.test} test`} />
        <Kpi value={model.arch.join('–')} label="Architecture (MLP)"
          sub={`perte finale ${model.training.final_loss}`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        <div className="card">
          <h3>Régions d'apprentissage</h3>
          <table>
            <thead><tr><th>Région</th><th className="num">Réf.</th>
              <th className="num">Densité/ha</th><th className="num">DBH</th>
              <th className="num">OA</th><th className="num">Anomalie</th></tr></thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.region}>
                  <td><b>{r.region}</b><div className="muted" style={{ fontSize: 11 }}>
                    {r.species.slice(0, 3).join(', ')}</div></td>
                  <td className="num">{r.reference?.total ?? '–'}</td>
                  <td className="num">{r.density[0]}</td>
                  <td className="num">{r.dbh[0]}</td>
                  <td className="num">{Math.round(r.oaRatio[0] * 100)}%</td>
                  <td className="num">{r.suspect[0]}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Données de référence synthétiques reproduisant les ordres de grandeur des
            massifs camerounais — à remplacer par les inventaires réels des sociétés
            certifiées (<code>npm run train</code> relit <code>data/reference/</code>).
          </p>
        </div>

        <Simulator />
      </div>

      {scan && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Analyse de la concession par le modèle</h3>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
            {Object.entries(CONFORMITY).map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 22, fontWeight: 700, color: v.color }}>
                  {scan.distribution[k] ?? 0}</div>
                <div className="muted">{v.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            {Object.entries(CONFORMITY).map(([k, v]) => (
              <div key={k} style={{ marginBottom: 6 }}>
                <Bar value={scan.distribution[k] ?? 0} max={scan.total} color={v.color} />
              </div>
            ))}
          </div>
          <h3>UC signalées atypiques par le réseau</h3>
          <table>
            <thead><tr><th>UC</th><th>Bloc</th><th>Région</th>
              <th className="num">Conformité</th><th className="num">Taux anomalie</th></tr></thead>
            <tbody>
              {scan.flagged.map((u) => (
                <tr key={u.uc_id} className="rowlink">
                  <td><Link to={`/ucs/${u.uc_id}`}>{u.uc_id}</Link></td>
                  <td>{u.bloc}</td><td>{u.region}</td>
                  <td className="num" style={{ color: 'var(--red)' }}>{u.conformity}%</td>
                  <td className="num">{u.suspect_rate_pct}%</td>
                </tr>
              ))}
              {scan.flagged.length === 0 &&
                <tr><td colSpan="5" className="muted">Aucune UC atypique.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
