import { api } from '../lib/api.js';
import { useAsync, Spinner, ErrorBox } from '../components/ui.jsx';

export default function Dbh() {
  const { loading, data, error } = useAsync(() => api.dbh());
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const max = Math.max(...data.map((d) => d.n), 1);
  const total = data.reduce((s, d) => s + d.n, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Distribution des diamètres (DBH)</h2>
          <p>Classes de 10 cm sur {total} tiges mesurées.</p>
        </div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 260,
          padding: '10px 0' }}>
          {data.map((d) => (
            <div key={d.from} title={`${d.from}–${d.to} cm : ${d.n}`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column',
                justifyContent: 'flex-end', alignItems: 'center', height: '100%' }}>
              <span className="muted" style={{ fontSize: 11 }}>{d.n}</span>
              <div style={{ width: '100%', height: `${(d.n / max) * 100}%`,
                background: 'linear-gradient(var(--grn),#2f7a24)', borderRadius: '5px 5px 0 0',
                minHeight: 2 }} />
              <span className="muted" style={{ fontSize: 10, marginTop: 4 }}>{d.from}</span>
            </div>
          ))}
        </div>
        <div className="muted" style={{ textAlign: 'center' }}>DBH (cm)</div>
      </div>
    </>
  );
}
