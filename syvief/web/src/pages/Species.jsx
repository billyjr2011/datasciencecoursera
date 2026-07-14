import { api } from '../lib/api.js';
import { useAsync, Spinner, ErrorBox, Bar } from '../components/ui.jsx';

export default function Species() {
  const { loading, data, error } = useAsync(() => api.statsSpecies());
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const max = Math.max(...data.map((s) => s.n), 1);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Répartition par espèce</h2>
          <p>Espèces relevées sur les {data.reduce((s, r) => s + r.n, 0)} tiges irrégulières contrôlées.</p>
        </div>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Espèce</th><th className="num">Tiges</th><th className="num">%</th>
            <th className="num">Qualité OA</th><th className="num">DBH moyen</th>
            <th style={{ width: '30%' }}>Part</th></tr></thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.species}>
                <td><b>{s.species}</b></td>
                <td className="num">{s.n}</td>
                <td className="num">{s.pct}%</td>
                <td className="num">{s.oa}</td>
                <td className="num">{s.mean_dbh_cm} cm</td>
                <td><Bar value={s.n} max={max} color="var(--grn)" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
