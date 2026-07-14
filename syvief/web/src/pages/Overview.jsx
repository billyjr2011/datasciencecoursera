import { Link } from 'react-router-dom';
import { api, REVIEW } from '../lib/api.js';
import { useAsync, Spinner, ErrorBox, Kpi, Bar, SeverityBadge } from '../components/ui.jsx';

export default function Overview() {
  const { loading, data, error } = useAsync(() =>
    Promise.all([api.overview(), api.meta(), api.worst(8)]));
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const [ov, meta, worst] = data;
  const reviewMap = Object.fromEntries(ov.review.map((r) => [r.status, r.n]));

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Aperçu de la campagne de contrôle</h2>
          <p>{meta.title} · Région {meta.region} · {meta.crs} · UC {meta.ucDimensions?.width_m}×{meta.ucDimensions?.height_m} m ({meta.ucDimensions?.area_ha} ha)</p>
        </div>
        <Link className="btn ghost" to="/map">Ouvrir la carte GIS</Link>
      </div>

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <Kpi value={ov.ucs} label="Unités de comptage" sub={`${ov.edge} en bordure`} />
        <Kpi value={ov.trees_total.toLocaleString('fr')} label="Tiges inventoriées" />
        <Kpi value={`${ov.suspect_rate_pct}%`} label="Taux d'anomalie moyen"
          accent="var(--amb)" sub={`${ov.suspect_count} tiges suspectes`} />
        <Kpi value={ov.critical} label="UC critiques" accent="var(--red)"
          sub={`${ov.warning} en vigilance`} />
        <Kpi value={ov.species} label="Espèces relevées" />
        <Kpi value={ov.alerts} label="Alertes d'isolement" accent="var(--pur)" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <h3>Avancement des vérifications</h3>
          {Object.keys(REVIEW).map((k) => {
            const n = reviewMap[k] || 0;
            return (
              <div key={k} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span>{REVIEW[k].label}</span><b>{n}</b>
                </div>
                <Bar value={n} max={ov.ucs} color={REVIEW[k].color} />
              </div>
            );
          })}
        </div>

        <div className="card">
          <h3>Conformité des UC</h3>
          {[[2, 'critical'], [1, 'warning'], [0, 'ok']].map(([lvl, key]) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <SeverityBadge level={lvl} /><b>{ov[key]}</b>
              </div>
              <Bar value={ov[key]} max={ov.ucs}
                color={lvl === 2 ? 'var(--red)' : lvl === 1 ? 'var(--amb)' : 'var(--grn)'} />
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>UC les plus problématiques</h3>
        <table>
          <thead><tr><th>UC</th><th>Bloc</th><th className="num">Taux</th>
            <th className="num">Suspectes</th><th className="num">Tiges</th><th>Sévérité</th></tr></thead>
          <tbody>
            {worst.map((u) => (
              <tr key={u.uc_id} className="rowlink">
                <td><Link to={`/ucs/${u.uc_id}`}>{u.uc_id}</Link></td>
                <td>{u.bloc}</td>
                <td className="num">{u.suspect_rate_pct}%</td>
                <td className="num">{u.suspect_count}</td>
                <td className="num">{u.trees_total}</td>
                <td><SeverityBadge level={u.severity} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
