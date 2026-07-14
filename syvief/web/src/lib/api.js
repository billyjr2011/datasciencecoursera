// Client API minimal pour SYVIEF.
const BASE = import.meta.env.VITE_API_BASE || '/api';

async function req(path, opts) {
  const res = await fetch(BASE + path, {
    headers: { 'content-type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const qs = (o = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o))
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  health: () => req('/health'),
  meta: () => req('/meta'),
  overview: () => req('/stats/overview'),
  statsSpecies: () => req('/stats/species'),
  dbh: () => req('/stats/dbh'),
  worst: (limit = 10) => req(`/stats/worst${qs({ limit })}`),
  blocs: () => req('/blocs'),
  bloc: (id) => req(`/blocs/${id}`),
  ucs: (filters) => req(`/ucs${qs(filters)}`),
  uc: (id) => req(`/ucs/${id}`),
  ucVerifications: (id) => req(`/ucs/${id}/verifications`),
  verify: (id, payload) =>
    req(`/ucs/${id}/verifications`, { method: 'POST', body: JSON.stringify(payload) }),
  trees: (filters) => req(`/trees${qs(filters)}`),
  alerts: (filters) => req(`/alerts${qs(filters)}`),
};

export const REVIEW = {
  a_verifier: { label: 'À vérifier', color: '#64748b' },
  en_cours: { label: 'En cours', color: '#38bdf8' },
  valide: { label: 'Validé', color: '#5fb84a' },
  rejete: { label: 'Rejeté', color: '#ef4444' },
};

export const SEVERITY = {
  0: { label: 'Conforme', color: '#5fb84a' },
  1: { label: 'Vigilance', color: '#f59e0b' },
  2: { label: 'Critique', color: '#ef4444' },
};
