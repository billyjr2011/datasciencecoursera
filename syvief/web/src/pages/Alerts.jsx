import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync, Spinner, ErrorBox, SeverityBadge } from '../components/ui.jsx';

export default function Alerts() {
  const { loading, data, error } = useAsync(() => api.alerts());
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Alertes d'isolement</h2>
          <p>Tiges relevées à distance anormale de leurs congénères — priorités de contrôle terrain.</p>
        </div>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>UC</th><th>Bloc</th><th>Espèce</th>
            <th className="num">Distance</th><th>Sévérité UC</th></tr></thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id}>
                <td><Link to={`/ucs/${a.uc_id}`}><b>{a.uc_id}</b></Link></td>
                <td>{a.bloc}</td>
                <td>{a.species}</td>
                <td className="num">{a.distance_m != null ? `${a.distance_m} m` : '–'}</td>
                <td><SeverityBadge level={a.severity} /></td>
              </tr>
            ))}
            {data.length === 0 &&
              <tr><td colSpan="5" className="muted">Aucune alerte.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
