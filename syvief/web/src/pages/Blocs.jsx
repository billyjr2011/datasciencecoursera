import { api } from '../lib/api.js';
import { useAsync, Spinner, ErrorBox, Bar } from '../components/ui.jsx';

export default function Blocs() {
  const { loading, data, error } = useAsync(() => api.blocs());
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const maxUcs = Math.max(...data.map((b) => b.ucs), 1);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Blocs & assiettes de coupe</h2>
          <p>Synthèse de conformité par bloc d'exploitation.</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
        {data.map((b) => (
          <div className="card" key={b.bloc}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: b.color }}>{b.bloc}</h3>
              <span className="muted">{b.ucs} UC</span>
            </div>
            <div style={{ margin: '12px 0' }}><Bar value={b.ucs} max={maxUcs} color={b.color} /></div>
            <div className="def" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div><span>Tiges</span><b>{b.trees_total}</b></div>
              <div><span>Taux d'anomalie</span><b>{b.suspect_rate_pct}%</b></div>
              <div><span>Qualité OA</span><b>{b.grade_oa}</b></div>
              <div><span>DBH moyen</span><b>{b.mean_dbh_cm} cm</b></div>
              <div><span>Critiques</span><b style={{ color: 'var(--red)' }}>{b.critical}</b></div>
              <div><span>Vigilance</span><b style={{ color: 'var(--amb)' }}>{b.warning}</b></div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Détail par bloc</h3>
        <table>
          <thead><tr><th>Bloc</th><th className="num">UC</th><th className="num">Tiges</th>
            <th className="num">Suspectes</th><th className="num">Taux</th>
            <th className="num">Critiques</th><th className="num">DBH</th></tr></thead>
          <tbody>
            {data.map((b) => (
              <tr key={b.bloc}>
                <td><b style={{ color: b.color }}>{b.bloc}</b></td>
                <td className="num">{b.ucs}</td>
                <td className="num">{b.trees_total}</td>
                <td className="num">{b.suspect_count}</td>
                <td className="num">{b.suspect_rate_pct}%</td>
                <td className="num">{b.critical}</td>
                <td className="num">{b.mean_dbh_cm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
