/*
 * TTMIP.jsx — Tropical Timber Market Intelligence Platform
 * Single-file React component port of the TTMIP v8 dashboard.
 *
 * Usage:
 *   import TTMIP from './TTMIP.jsx';
 *   <TTMIP />               // same-origin API at /api/v1, falls back to demo data
 *   <TTMIP apiBase="https://api.ttmip.cm" />
 *
 * - Zero external deps beyond React (charts are lightweight inline SVG/CSS).
 * - Hydrates prices/alerts/esg/certs/ddra/markets/indices/regulations from the
 *   TTMIP API; if unreachable, deterministic generators keep the UI functional.
 */
import React, { useEffect, useMemo, useState } from 'react';

/* ─────────────────────────── Design tokens ─────────────────────────── */
const T = {
  bg: '#07090D', surface: '#0C1118', panel: '#111923', panel2: '#141F2B',
  border: '#192433', border2: '#1F3044',
  accent: '#E8873A', accent2: '#F4A233', accent3: '#FBC05A',
  green: '#1A9E5F', green2: '#22C97A', red: '#D94040', red2: '#FF6060',
  blue: '#2272C3', blue2: '#3A9FE8', purple: '#7B52C8', purple2: '#A07EEF',
  gold2: '#F5C842', teal2: '#1ECFB0',
  camGreen: '#007A5E', camRed: '#CE1126',
  text: '#D6E4F0', text2: '#6A91B0', text3: '#2E4A62',
};

/* ─────────────────────────── Reference data ────────────────────────── */
const SPECIES_30 = [
  'Sapelli', 'Ayous', 'Azobé', 'Iroko', 'Padouk', 'Dibetou', 'Bilinga', 'Frake', 'Movingui', 'Mahogany',
  'Tali', 'Doussié', 'Wengé', 'Bubinga', 'Ebène', 'Moabi', 'Tiama', 'Longhi', 'Niové', 'Ilomba',
  'Bokassa', 'Sipo', 'Tchitola', 'Landa', 'Eyong', 'Naga', 'Mukulungu', 'Panga-Panga', 'Ozigo', 'Limbali',
];
const MARKETS_15 = [
  { code: 'EU', name: 'European Union', flag: '🇪🇺', color: '#3A9FE8', curr: 'EUR', volume: 3820, price: 1180, growth: 2.1, share: 28.4, region: 'EU' },
  { code: 'FR', name: 'France', flag: '🇫🇷', color: '#4A90D9', curr: 'EUR', volume: 2140, price: 1220, growth: 1.8, share: 15.9, region: 'EU' },
  { code: 'CN', name: 'China', flag: '🇨🇳', color: '#D94040', curr: 'USD', volume: 4100, price: 780, growth: 5.4, share: 30.5, region: 'Asia' },
  { code: 'IN', name: 'India', flag: '🇮🇳', color: '#E87F3A', curr: 'USD', volume: 980, price: 590, growth: 8.2, share: 7.3, region: 'Asia' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', color: '#D94040', curr: 'USD', volume: 1240, price: 680, growth: 12.1, share: 9.2, region: 'Asia' },
  { code: 'US', name: 'United States', flag: '🇺🇸', color: '#2272C3', curr: 'USD', volume: 870, price: 1050, growth: 0.9, share: 6.5, region: 'USA' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', color: '#27AE60', curr: 'EUR', volume: 620, price: 1160, growth: 1.2, share: 4.6, region: 'EU' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', color: '#F4A233', curr: 'EUR', volume: 540, price: 1140, growth: 0.8, share: 4.0, region: 'EU' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', color: '#D94040', curr: 'USD', volume: 480, price: 510, growth: 3.7, share: 3.6, region: 'Other' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', color: '#2272C3', curr: 'USD', volume: 310, price: 1280, growth: -1.1, share: 2.3, region: 'Asia' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', color: '#3A9FE8', curr: 'USD', volume: 260, price: 1050, growth: 2.4, share: 1.9, region: 'Asia' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', color: '#27AE60', curr: 'USD', volume: 190, price: 720, growth: 4.1, share: 1.4, region: 'Asia' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', color: '#E87F3A', curr: 'EUR', volume: 450, price: 1110, growth: 1.5, share: 3.3, region: 'EU' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', color: '#27AE60', curr: 'USD', volume: 220, price: 940, growth: 6.3, share: 1.6, region: 'Other' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪', color: '#7B52C8', curr: 'USD', volume: 180, price: 980, growth: 9.2, share: 1.3, region: 'Other' },
];
const PLATFORMS = ['Fastmarkets', 'ITTO MIS', 'Timber Exchange', 'BVRio', 'Hardwood Review', 'WoodMarket'];
const COMPANIES = ['Société Forestière', 'Pallisco', 'Wijma Cameroon', 'Alpicam', 'SFID', 'GRUMCAM', 'SIM', 'FIPCAM'];
const REGULATIONS = [
  { code: 'EUDR', name: 'EUDR', flag: '🇪🇺', market: 'European Union', status: 'ACTIVE — enforcement Dec 2026', risk: 'Critical', priceImpact: -12.4, complianceRate: 58, camStatus: 'Partial', complianceCost: '+$18-35/m³', description: 'Bans EU placement of timber from land deforested after 31 Dec 2020. Large/medium operators 30 Dec 2026; micro/small 30 Jun 2027. Requires GPS geolocation + DDS via EU TRACES NT.' },
  { code: 'EUTR', name: 'EUTR', flag: '🇪🇺', market: 'European Union', status: 'Operative until 30 Dec 2026', risk: 'Medium', priceImpact: -6.2, complianceRate: 78, camStatus: 'Compliant', complianceCost: '+$8-15/m³', description: 'Prohibits illegally harvested timber on the EU market; requires operator due-diligence system. Repealed and replaced by EUDR on 30 Dec 2026.' },
  { code: 'FLEGT', name: 'FLEGT VPA — TERMINATED', flag: '🇨🇲', market: 'EU (historical)', status: 'TERMINATED — 30 Nov 2025', risk: 'N/A', priceImpact: 0, complianceRate: 0, camStatus: 'TERMINATED', complianceCost: 'N/A', description: 'EU-Cameroon VPA ceased 30 Nov 2025 (Council Decision 2025/1976). Cameroon now has no simplified EUDR pathway — full independent due-diligence required.' },
  { code: 'LACEY', name: 'Lacey Act', flag: '🇺🇸', market: 'United States', status: 'Active — amendments pending', risk: 'Medium', priceImpact: -4.8, complianceRate: 71, camStatus: 'Compliant', complianceCost: '+$6-12/m³', description: 'Prohibits trade in illegally sourced plants; requires PPQ Form 505 import declarations with species + country of harvest. Strict-liability with due-care defence.' },
  { code: 'CITES', name: 'CITES', flag: '🌍', market: 'Global', status: 'Active', risk: 'Medium', priceImpact: -3.1, complianceRate: 82, camStatus: 'Compliant', complianceCost: '+$4-9/m³', description: 'Regulates trade in listed species via permits. Several tropical hardwoods (Bubinga, Wengé) are Appendix II — export permits + non-detriment findings required.' },
];

/* ─────────────────────── Deterministic generators ──────────────────── */
let _s = 0x9e3779b9;
const rand = () => { _s = (_s + 0x6d2b79f5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rnd = (a, b) => +(rand() * (b - a) + a).toFixed(2);
const rndI = (a, b) => Math.floor(rand() * (b - a + 1) + a);
const pick = (arr) => arr[rndI(0, arr.length - 1)];
const DAY = 86_400_000;

const genPrices = (n = 200) => Array.from({ length: n }, (_, i) => {
  const m = pick(MARKETS_15);
  const r = rand();
  return { id: i + 1, platform: pick(PLATFORMS), species: pick(SPECIES_30), destination: m.code, destName: m.name, price: rnd(420, 1450), volume: rndI(80, 9000), quality: r < 0.68 ? 'High' : r < 0.88 ? 'Medium' : 'Low', ts: new Date(Date.now() - rndI(0, 3600) * 1000) };
});
const genAlerts = (n = 30) => {
  const zones = ['Lobéké NP', 'Dja Reserve', "Campo-Ma'an", 'Ngoyla-Mintom', 'Mbam & Djerem', 'Bénoué NP', 'Waza NP', 'Boumba-Bek', 'Takamanda NR', 'Korup NP'];
  return Array.from({ length: n }, (_, i) => {
    const confidence = rnd(0.3, 0.98);
    return { id: `ALERT-${String(i + 1).padStart(3, '0')}`, lat: rnd(2, 13), lng: rnd(8, 16), confidence, date: new Date(Date.now() - rndI(1, 30) * DAY).toISOString().slice(0, 10), area: rnd(0.1, 25), source: pick(['GFW', 'WRI', 'NASA', 'EU JRC']), zone: pick(zones), severity: confidence >= 0.8 ? 'High' : confidence >= 0.5 ? 'Medium' : 'Low' };
  });
};
const genESG = () => COMPANIES.map((c) => {
  const env = rndI(38, 92), soc = rndI(40, 90), gov = rndI(32, 85);
  const overall = +((env + soc + gov) / 3).toFixed(1);
  return { company: c, env, soc, gov, overall, risk: overall >= 70 ? 'Low' : overall >= 50 ? 'Medium' : overall >= 30 ? 'High' : 'Critical', date: new Date(Date.now() - rndI(1, 90) * DAY).toISOString().slice(0, 10) };
});
const genCerts = (n = 50) => Array.from({ length: n }, (_, i) => {
  const issue = new Date(Date.now() - rndI(30, 1095) * DAY);
  const expiry = new Date(issue.getTime() + 3 * 365 * DAY);
  const daysLeft = Math.round((expiry - Date.now()) / DAY);
  const type = pick(['FSC', 'PEFC', 'Both', 'None']);
  return { id: `CONC-${String(i + 1).padStart(3, '0')}`, name: pick(COMPANIES), type, issue: issue.toISOString().slice(0, 10), expiry: expiry.toISOString().slice(0, 10), daysLeft, status: type === 'None' ? 'No Cert' : daysLeft > 90 ? 'Active' : daysLeft > 0 ? 'Expiring' : 'Expired' };
});
const genDDRA = (n = 100) => Array.from({ length: n }, (_, i) => {
  const risk = rnd(0, 10);
  return { id: `SHIP-${String(i + 1).padStart(4, '0')}`, company: pick(COMPANIES), risk, date: new Date(Date.now() - rndI(1, 60) * DAY).toISOString().slice(0, 10), status: risk <= 3 ? 'Compliant' : risk <= 6 ? 'Under Review' : risk <= 8 ? 'Non-Compliant' : 'Critical' };
});
const genIndex = (base, drift, n = 36) => { let v = base * 0.85; return Array.from({ length: n }, (_, i) => { v = v * (1 + drift / 100) + (rand() - 0.5) * 2.5; const d = new Date(); d.setMonth(d.getMonth() - (n - 1 - i)); return { date: d.toISOString().slice(0, 7), value: +v.toFixed(1) }; }); };

/* ──────────────────────────── API client ───────────────────────────── */
function makeApi(apiBase) {
  const base = (apiBase ?? (typeof window !== 'undefined' ? window.TTMIP_API_BASE : '') ?? '') + '/api/v1';
  const get = async (path, params) => {
    let url = base + path;
    if (params) { const qs = Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&'); if (qs) url += '?' + qs; }
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`API ${res.status} ${path}`);
    return (await res.json()).data;
  };
  return {
    async hydrate() {
      try {
        const [prices, alerts, esg, certs, ddra] = await Promise.all([
          get('/prices', { limit: 200 }), get('/alerts', { limit: 30 }), get('/esg'), get('/certificates'), get('/ddra'),
        ]);
        return { prices: prices.map((p) => ({ ...p, ts: new Date(p.ts) })), alerts, esg, certs, ddra, live: true };
      } catch (e) {
        console.warn('[TTMIP] API unreachable — demo data.', e.message);
        return { prices: genPrices(), alerts: genAlerts(), esg: genESG(), certs: genCerts(), ddra: genDDRA(), live: false };
      }
    },
  };
}

/* ────────────────────────────── Hooks ──────────────────────────────── */
function useTTMIPData(apiBase) {
  const [data, setData] = useState(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let on = true;
    makeApi(apiBase).hydrate().then((d) => { if (on) { setData(d); setLive(d.live); } });
    return () => { on = false; };
  }, [apiBase]);
  return { data, live };
}

/* ────────────────────────── Small components ───────────────────────── */
const Badge = ({ tone = 'green', children }) => {
  const tones = {
    green: [T.green2, 'rgba(34,201,122,0.12)'], yellow: [T.accent2, 'rgba(244,162,51,0.12)'],
    red: [T.red2, 'rgba(217,64,64,0.12)'], blue: [T.blue2, 'rgba(58,159,232,0.12)'],
    purple: [T.purple2, 'rgba(123,82,200,0.12)'], gold: [T.gold2, 'rgba(212,162,42,0.12)'], teal: [T.teal2, 'rgba(30,207,176,0.12)'],
  };
  const [c, bg] = tones[tone] || tones.green;
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 3, fontSize: 9, fontWeight: 700, fontFamily: 'monospace', color: c, background: bg, border: `1px solid ${c}33` }}>{children}</span>;
};

const Card = ({ title, actions, children, pad = true }) => (
  <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
    {title && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 15px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{title}</div>
        <div style={{ display: 'flex', gap: 4 }}>{actions}</div>
      </div>
    )}
    <div style={pad ? { padding: '13px 15px' } : undefined}>{children}</div>
  </div>
);

const KpiCard = ({ color, label, value, suffix, chg, chgUp, meta, icon, onClick }) => (
  <div onClick={onClick} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
    <div style={{ fontSize: 9, color: T.text3, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 7 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 6 }}>{value}<span style={{ fontSize: 12, opacity: 0.5 }}>{suffix}</span></div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: T.text2 }}>
      {chg != null && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 5px', borderRadius: 3, fontFamily: 'monospace', color: chgUp ? T.green2 : T.red2, background: chgUp ? 'rgba(34,201,122,0.13)' : 'rgba(217,64,64,0.13)' }}>{chgUp ? '▲' : '▼'} {chg}</span>}
      <span style={{ color: T.text3 }}>{meta}</span>
    </div>
    <div style={{ position: 'absolute', right: 12, bottom: 10, fontSize: 26, opacity: 0.18 }}>{icon}</div>
  </div>
);

const Table = ({ columns, rows, maxHeight = 360 }) => (
  <div style={{ overflow: 'auto', maxHeight }}>
    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
      <thead>
        <tr>{columns.map((c) => <th key={c.key} style={{ textAlign: c.align || 'left', fontSize: 8.5, fontWeight: 700, color: T.text3, letterSpacing: '0.11em', textTransform: 'uppercase', padding: '6px 8px', borderBottom: `1px solid ${T.border}`, fontFamily: 'monospace', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: T.panel }}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{columns.map((c) => <td key={c.key} style={{ padding: '6px 8px', borderBottom: `1px solid rgba(25,36,51,0.7)`, textAlign: c.align || 'left', whiteSpace: 'nowrap' }}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>
        ))}
      </tbody>
    </table>
  </div>
);

const BarChart = ({ items }) => {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 9.5, color: T.text2, fontFamily: 'monospace', width: 80, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</div>
          <div style={{ flex: 1, height: 8, background: T.border, borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(it.value / max) * 100}%`, background: it.color || T.accent, borderRadius: 5, transition: 'width .9s' }} />
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: T.text2, width: 60, textAlign: 'right', fontFamily: 'monospace', flexShrink: 0 }}>{it.display ?? it.value}</div>
        </div>
      ))}
    </div>
  );
};

const Gauge = ({ value, color, label }) => {
  const r = 24, circ = 2 * Math.PI * r, off = circ * (1 - value / 100);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <svg viewBox="0 0 64 64" width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="32" cy="32" r={r} fill="none" stroke={T.border2} strokeWidth="6" />
          <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color }}>{value}</div>
      </div>
      <div style={{ fontSize: 8.5, color: T.text3, fontFamily: 'monospace', marginTop: 4 }}>{label}</div>
    </div>
  );
};

const LineChart = ({ series, color, height = 220 }) => {
  const w = 600, h = height, pad = 28;
  const vals = series.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const xOf = (i) => pad + (i / (series.length - 1)) * (w - pad * 2);
  const yOf = (v) => h - pad - ((v - min) / span) * (h - pad * 2);
  const path = series.map((p, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${xOf(series.length - 1)},${h - pad} L${xOf(0)},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }}>
      <defs><linearGradient id={`g-${color}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.28" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#g-${color})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      {series.map((p, i) => i % 6 === 0 && <text key={i} x={xOf(i)} y={h - 8} fontSize="8" fill={T.text3} textAnchor="middle" fontFamily="monospace">{p.date}</text>)}
    </svg>
  );
};

/* ──────────────────────────── Tab pages ────────────────────────────── */
const sevTone = (s) => ({ High: 'red', Medium: 'yellow', Low: 'gold' }[s] || 'blue');
const riskTone = (r) => ({ Low: 'green', Medium: 'yellow', High: 'red', Critical: 'red' }[r] || 'blue');
const statusTone = (s) => ({ Compliant: 'green', Active: 'green', 'Under Review': 'yellow', Expiring: 'yellow', 'Non-Compliant': 'red', Expired: 'red', Critical: 'red', 'No Cert': 'blue' }[s] || 'blue');

function Dashboard({ data, setTab }) {
  const avg = useMemo(() => Math.round(data.prices.reduce((s, p) => s + p.price, 0) / data.prices.length), [data]);
  const high = data.alerts.filter((a) => a.severity === 'High').length;
  const topMarkets = [...MARKETS_15].sort((a, b) => b.volume - a.volume).slice(0, 6);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
        <KpiCard color={T.accent} label="Avg Timber Price" value={`$${avg}`} suffix="/m³" chg="+3.2%" chgUp meta="vs last month" icon="💰" onClick={() => setTab('prices')} />
        <KpiCard color={T.red} label="Forest Alerts" value={data.alerts.length} suffix=" active" chg={`${high} High`} meta="priority" icon="🌲" onClick={() => setTab('alerts')} />
        <KpiCard color={T.blue} label="GSPI Index" value="124.7" chg="+1.8%" chgUp meta="Global Sawlog" icon="🌐" onClick={() => setTab('indices')} />
        <KpiCard color={T.green} label="Active Markets" value="15" suffix=" mkts" chg="+2 new" chgUp meta="this quarter" icon="🌍" onClick={() => setTab('markets')} />
        <KpiCard color={T.purple} label="Regulatory" value={REGULATIONS.length} suffix=" frwks" chg="3 changes" meta="this month" icon="⚖️" onClick={() => setTab('regulatory')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Card title="🌍 Top Markets by Volume">
          <BarChart items={topMarkets.map((m) => ({ label: `${m.flag} ${m.name}`, value: m.volume, display: m.volume.toLocaleString(), color: m.color }))} />
        </Card>
        <Card title="🛰️ Deforestation Alerts">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, textAlign: 'center', fontFamily: 'monospace', fontSize: 9.5 }}>
            {[['High', high, T.red], ['Medium', data.alerts.filter((a) => a.severity === 'Medium').length, T.accent2], ['Low', data.alerts.filter((a) => a.severity === 'Low').length, T.gold2]].map(([l, v, c]) => (
              <div key={l}><div style={{ color: c, fontSize: 22, fontWeight: 800 }}>{v}</div><div style={{ color: T.text3 }}>{l}</div></div>
            ))}
          </div>
          <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.alerts.slice(0, 4).map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                <span style={{ color: T.text2 }}>{a.severity === 'High' ? '🔴' : a.severity === 'Medium' ? '🟡' : '🟢'} {a.zone}</span>
                <span style={{ color: T.text3, fontFamily: 'monospace' }}>{a.area} ha</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card title="📋 Latest Prices — Multi-Platform">
        <Table maxHeight={300} rows={data.prices.slice(0, 30)} columns={[
          { key: 'species', label: 'Species' },
          { key: 'platform', label: 'Platform' },
          { key: 'destName', label: 'Destination' },
          { key: 'price', label: 'Price', align: 'right', render: (r) => `$${r.price}` },
          { key: 'volume', label: 'Volume', align: 'right', render: (r) => r.volume.toLocaleString() },
          { key: 'quality', label: 'Quality', render: (r) => <Badge tone={r.quality === 'High' ? 'green' : r.quality === 'Medium' ? 'yellow' : 'red'}>{r.quality}</Badge> },
        ]} />
      </Card>
    </>
  );
}

function Prices({ data }) {
  const [q, setQ] = useState(''); const [qual, setQual] = useState('');
  const rows = data.prices.filter((p) => (!q || `${p.species} ${p.platform} ${p.destName}`.toLowerCase().includes(q.toLowerCase())) && (!qual || p.quality === qual));
  return (
    <Card title="📋 All Price Records" actions={<>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={inputStyle} />
      <select value={qual} onChange={(e) => setQual(e.target.value)} style={inputStyle}><option value="">All Quality</option><option>High</option><option>Medium</option><option>Low</option></select>
    </>}>
      <Table maxHeight={460} rows={rows} columns={[
        { key: 'id', label: '#' }, { key: 'species', label: 'Species' }, { key: 'platform', label: 'Platform' }, { key: 'destName', label: 'Destination' },
        { key: 'price', label: 'Price', align: 'right', render: (r) => `$${r.price}` },
        { key: 'volume', label: 'Volume m³', align: 'right', render: (r) => r.volume.toLocaleString() },
        { key: 'quality', label: 'Quality', render: (r) => <Badge tone={r.quality === 'High' ? 'green' : r.quality === 'Medium' ? 'yellow' : 'red'}>{r.quality}</Badge> },
      ]} />
      <div style={{ marginTop: 8, fontSize: 10, color: T.text3, fontFamily: 'monospace' }}>{rows.length} records</div>
    </Card>
  );
}

function Markets() {
  const [sort, setSort] = useState('volume');
  const rows = [...MARKETS_15].sort((a, b) => b[sort] - a[sort]);
  return (
    <Card title="🌍 Market Performance — Cameroon Exports" actions={['volume', 'price', 'growth'].map((s) => (
      <Chip key={s} active={sort === s} onClick={() => setSort(s)}>Sort: {s}</Chip>
    ))}>
      <Table maxHeight={460} rows={rows} columns={[
        { key: 'name', label: 'Market', render: (r) => `${r.flag} ${r.name}` },
        { key: 'region', label: 'Region' },
        { key: 'volume', label: 'Volume', align: 'right', render: (r) => r.volume.toLocaleString() },
        { key: 'price', label: 'Avg Price', align: 'right', render: (r) => `${r.curr === 'EUR' ? '€' : '$'}${r.price}` },
        { key: 'share', label: 'Share', align: 'right', render: (r) => `${r.share}%` },
        { key: 'growth', label: 'Growth', align: 'right', render: (r) => <Badge tone={r.growth >= 0 ? 'green' : 'red'}>{r.growth >= 0 ? '▲' : '▼'} {Math.abs(r.growth)}%</Badge> },
      ]} />
    </Card>
  );
}

function Indices() {
  const gspi = useMemo(() => genIndex(124.7, 0.9), []);
  const espi = useMemo(() => genIndex(106.3, 0.5), []);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <Card title="🌐 GSPI — Global Sawlog Price Index" actions={<Badge tone="blue">124.7 pts</Badge>}><LineChart series={gspi} color={T.accent} /></Card>
      <Card title="🇪🇺 ESPI — European Sawlog Price Index" actions={<Badge tone="blue">106.3 pts</Badge>}><LineChart series={espi} color={T.green2} /></Card>
    </div>
  );
}

function ESG({ data }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {data.esg.slice(0, 4).map((e) => (
          <Card key={e.company} pad>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10 }}>{e.company}</div>
            <div style={{ display: 'flex', gap: 10 }}><Gauge value={e.env} color={T.green2} label="ENV" /><Gauge value={e.soc} color={T.blue2} label="SOC" /><Gauge value={e.gov} color={T.accent} label="GOV" /></div>
          </Card>
        ))}
      </div>
      <Card title="🌿 ESG Scores">
        <Table maxHeight={420} rows={[...data.esg].sort((a, b) => b.overall - a.overall)} columns={[
          { key: 'company', label: 'Company' },
          { key: 'env', label: 'Env', align: 'right' }, { key: 'soc', label: 'Soc', align: 'right' }, { key: 'gov', label: 'Gov', align: 'right' },
          { key: 'overall', label: 'Overall', align: 'right' },
          { key: 'risk', label: 'Risk', render: (r) => <Badge tone={riskTone(r.risk)}>{r.risk}</Badge> },
          { key: 'date', label: 'Assessed' },
        ]} />
      </Card>
    </>
  );
}

function Certs({ data }) {
  const [f, setF] = useState('');
  const rows = data.certs.filter((c) => !f || (f === 'expiring' ? c.status === 'Expiring' : c.type === f));
  return (
    <Card title="📜 Concession Certificates" actions={['', 'FSC', 'PEFC', 'expiring'].map((x) => (
      <Chip key={x || 'all'} active={f === x} onClick={() => setF(x)}>{x === '' ? 'All' : x === 'expiring' ? '⚠ Expiring' : x}</Chip>
    ))}>
      <Table maxHeight={460} rows={rows} columns={[
        { key: 'id', label: 'Concession' }, { key: 'name', label: 'Company' },
        { key: 'type', label: 'Type', render: (r) => <Badge tone={r.type === 'None' ? 'red' : 'teal'}>{r.type}</Badge> },
        { key: 'issue', label: 'Issued' }, { key: 'expiry', label: 'Expires' },
        { key: 'daysLeft', label: 'Days Left', align: 'right' },
        { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
      ]} />
    </Card>
  );
}

function Alerts({ data }) {
  const [f, setF] = useState('all');
  const rows = data.alerts.filter((a) => f === 'all' || a.severity === f);
  return (
    <Card title="🛰️ Deforestation Alerts — Cameroon" actions={['all', 'High', 'Medium', 'Low'].map((x) => (
      <Chip key={x} active={f === x} onClick={() => setF(x)}>{x === 'all' ? 'All' : x}</Chip>
    ))}>
      <Table maxHeight={460} rows={rows} columns={[
        { key: 'id', label: 'Alert ID' }, { key: 'zone', label: 'Zone' }, { key: 'source', label: 'Source' },
        { key: 'date', label: 'Date' },
        { key: 'area', label: 'Area ha', align: 'right' },
        { key: 'confidence', label: 'Conf.', align: 'right', render: (r) => `${(r.confidence * 100).toFixed(0)}%` },
        { key: 'severity', label: 'Severity', render: (r) => <Badge tone={sevTone(r.severity)}>{r.severity}</Badge> },
      ]} />
    </Card>
  );
}

function DDRA({ data }) {
  const [f, setF] = useState('');
  const rows = data.ddra.filter((d) => !f || d.status === f);
  return (
    <Card title="🛡️ DDRA Records (EUDR)" actions={<select value={f} onChange={(e) => setF(e.target.value)} style={inputStyle}><option value="">All Statuses</option><option>Compliant</option><option>Under Review</option><option>Non-Compliant</option><option>Critical</option></select>}>
      <Table maxHeight={460} rows={rows} columns={[
        { key: 'id', label: 'Shipment' }, { key: 'company', label: 'Company' }, { key: 'date', label: 'Assessed' },
        { key: 'risk', label: 'Risk', align: 'right', render: (r) => r.risk.toFixed(1) },
        { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
      ]} />
    </Card>
  );
}

function Regulatory() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {REGULATIONS.map((r) => (
        <Card key={r.code}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{r.flag}</span>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{r.name}</span>
                <Badge tone={riskTone(r.risk)}>{r.risk} risk</Badge>
              </div>
              <div style={{ fontSize: 10.5, color: T.text3, marginBottom: 8 }}>{r.market} · {r.status}</div>
              <div style={{ fontSize: 11.5, color: T.text2, maxWidth: 720, lineHeight: 1.5 }}>{r.description}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: T.text3, fontFamily: 'monospace' }}>PRICE IMPACT</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: r.priceImpact < 0 ? T.red2 : T.green2 }}>{r.priceImpact}%</div>
              <div style={{ fontSize: 10, color: T.text3, marginTop: 4 }}>{r.complianceCost}</div>
              <div style={{ marginTop: 6 }}><Badge tone={statusTone(r.camStatus) || 'purple'}>CM: {r.camStatus}</Badge></div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

const Placeholder = ({ icon, title }) => (
  <Card><div style={{ textAlign: 'center', padding: '48px 16px', color: T.text3 }}><div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div><div style={{ fontSize: 14, fontWeight: 700, color: T.text2 }}>{title}</div><div style={{ fontSize: 11, marginTop: 6 }}>Module scaffolded — wire to the API endpoint to populate.</div></div></Card>
);

/* ────────────────────────────── Chrome ─────────────────────────────── */
const inputStyle = { background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 5, color: T.text, fontSize: 10.5, padding: '4px 8px', outline: 'none' };
const Chip = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{ background: active ? 'rgba(232,135,58,0.08)' : T.surface, border: `1px solid ${active ? T.accent : T.border}`, color: active ? T.accent : T.text3, borderRadius: 4, padding: '3px 8px', fontSize: 9.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'monospace' }}>{children}</button>
);

const TABS = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' }, { id: 'prices', icon: '📈', label: 'Market Prices' },
  { id: 'markets', icon: '🌍', label: "Int'l Markets" }, { id: 'indices', icon: '📉', label: 'Price Indices' },
  { id: 'esg', icon: '🌿', label: 'ESG Scores' }, { id: 'certs', icon: '📜', label: 'Certificates' },
  { id: 'alerts', icon: '⚠️', label: 'Forest Alerts' }, { id: 'ddra', icon: '🛡️', label: 'Due Diligence' },
  { id: 'regulatory', icon: '⚖️', label: 'Regulatory' }, { id: 'trading', icon: '📊', label: 'Trading Desk' },
  { id: 'technical', icon: '📉', label: 'Technical' }, { id: 'publications', icon: '📰', label: 'Publications' },
  { id: 'fundamentals', icon: '🔭', label: 'Fundamentals' }, { id: 'faq', icon: '❓', label: 'FAQ' },
  { id: 'bi', icon: '🤖', label: 'AI Intelligence' },
];

export default function TTMIP({ apiBase }) {
  const [tab, setTab] = useState('dashboard');
  const { data, live } = useTTMIPData(apiBase);

  const body = () => {
    if (!data) return <div style={{ color: T.text3, padding: 40, fontFamily: 'monospace' }}>Loading market intelligence…</div>;
    switch (tab) {
      case 'dashboard': return <Dashboard data={data} setTab={setTab} />;
      case 'prices': return <Prices data={data} />;
      case 'markets': return <Markets />;
      case 'indices': return <Indices />;
      case 'esg': return <ESG data={data} />;
      case 'certs': return <Certs data={data} />;
      case 'alerts': return <Alerts data={data} />;
      case 'ddra': return <DDRA data={data} />;
      case 'regulatory': return <Regulatory />;
      default: return <Placeholder icon={TABS.find((t) => t.id === tab)?.icon} title={TABS.find((t) => t.id === tab)?.label} />;
    }
  };

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: '100vh', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* Topbar */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 52, position: 'sticky', top: 0, zIndex: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: `linear-gradient(135deg, ${T.camGreen}, ${T.camRed})`, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>CM</div>
          <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>TTMIP — Timber Intelligence</div><div style={{ fontSize: 9, color: T.text3, letterSpacing: '0.09em', textTransform: 'uppercase', fontFamily: 'monospace' }}>Ministry of Forests & Wildlife · Cameroon</div></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div title={live ? 'Connected to TTMIP API' : 'Offline demo data'} style={{ display: 'flex', alignItems: 'center', gap: 5, background: live ? 'rgba(34,201,122,0.09)' : 'rgba(244,162,51,0.09)', border: `1px solid ${live ? T.green2 : T.accent2}33`, borderRadius: 20, padding: '4px 10px', fontSize: 10, color: live ? T.green2 : T.accent2, fontFamily: 'monospace' }}>
            <span style={{ width: 5, height: 5, background: live ? T.green2 : T.accent2, borderRadius: '50%' }} />{live ? 'LIVE' : 'DEMO'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 20, padding: '3px 10px 3px 3px' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>MF</div>
            <span style={{ fontSize: 11, fontWeight: 500 }}>Min. Forests</span>
          </div>
        </div>
      </div>

      {/* Ticker */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '5px 20px', overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 9.5 }}>
        {(data?.prices || []).slice(0, 14).map((p) => (
          <span key={p.id} style={{ marginRight: 28, color: T.text2 }}>{p.species}·{p.destination} <span style={{ color: T.text }}>${Math.round(p.price)}</span></span>
        ))}
      </div>

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '205px 1fr', minHeight: 'calc(100vh - 80px)' }}>
        <div style={{ background: T.surface, borderRight: `1px solid ${T.border}`, padding: '14px 0' }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.text3, padding: '10px 13px 4px', fontFamily: 'monospace' }}>Navigation</div>
          {TABS.map((t) => (
            <div key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', fontSize: 12, fontWeight: 500, color: tab === t.id ? T.accent : T.text2, cursor: 'pointer', margin: '1px 7px', borderRadius: 6, background: tab === t.id ? 'rgba(232,135,58,0.1)' : 'transparent', border: `1px solid ${tab === t.id ? 'rgba(232,135,58,0.18)' : 'transparent'}`, userSelect: 'none' }}>
              <span style={{ fontSize: 13, width: 16, textAlign: 'center' }}>{t.icon}</span>{t.label}
            </div>
          ))}
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflowX: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{TABS.find((t) => t.id === tab)?.label}</div>
              <div style={{ fontSize: 11, color: T.text3, marginTop: 3 }}>30 Species · 15 Markets · 6 Data Platforms · 5 Regulatory Frameworks</div>
            </div>
          </div>
          {body()}
        </div>
      </div>
    </div>
  );
}
