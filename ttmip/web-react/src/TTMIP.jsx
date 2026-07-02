import React, { useEffect, useState } from 'react';
import { T } from './theme.js';
import { makeApi } from './data.js';
import {
  Dashboard, Prices, Markets, Indices, ESG, Certs, Alerts, DDRA, Regulatory,
  Trading, Technical, Publications, Fundamentals, FAQ, AIIntelligence,
  Feeds, FobCalculator, Sigif, Account,
} from './tabs.jsx';

const TABS = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' }, { id: 'prices', icon: '📈', label: 'Market Prices' },
  { id: 'markets', icon: '🌍', label: "Int'l Markets" }, { id: 'indices', icon: '📉', label: 'Price Indices' },
  { id: 'esg', icon: '🌿', label: 'ESG Scores' }, { id: 'certs', icon: '📜', label: 'Certificates' },
  { id: 'alerts', icon: '⚠️', label: 'Forest Alerts' }, { id: 'ddra', icon: '🛡️', label: 'Due Diligence' },
  { id: 'regulatory', icon: '⚖️', label: 'Regulatory' }, { id: 'trading', icon: '📊', label: 'Trading Desk' },
  { id: 'technical', icon: '📉', label: 'Technical' }, { id: 'publications', icon: '📰', label: 'Publications' },
  { id: 'fundamentals', icon: '🔭', label: 'Fundamentals' }, { id: 'faq', icon: '❓', label: 'FAQ' },
  { id: 'bi', icon: '🤖', label: 'AI Intelligence' },
  { id: 'feeds', icon: '🔌', label: 'Platform Feeds' },
  { id: 'fob', icon: '🧮', label: 'FOB Calculator' },
  { id: 'sigif', icon: '🔗', label: 'SIGIF2 Quotas' },
  { id: 'account', icon: '👤', label: 'Account & Plans' },
];

/** Loads dynamic data from the TTMIP API, falling back to demo generators. */
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

export default function TTMIP({ apiBase }) {
  const [tab, setTab] = useState('dashboard');
  const { data, live } = useTTMIPData(apiBase);

  const renderTab = () => {
    if (!data) return <div style={{ color: T.text3, padding: 40, fontFamily: 'DM Mono, monospace' }}>Loading market intelligence…</div>;
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
      case 'trading': return <Trading />;
      case 'technical': return <Technical />;
      case 'publications': return <Publications />;
      case 'fundamentals': return <Fundamentals />;
      case 'faq': return <FAQ />;
      case 'bi': return <AIIntelligence data={data} />;
      case 'feeds': return <Feeds />;
      case 'fob': return <FobCalculator />;
      case 'sigif': return <Sigif />;
      case 'account': return <Account />;
      default: return null;
    }
  };

  const active = TABS.find((t) => t.id === tab);

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: '100vh', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* Topbar */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 52, position: 'sticky', top: 0, zIndex: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="syne" style={{ width: 30, height: 30, background: `linear-gradient(135deg, ${T.camGreen}, ${T.camRed})`, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>CM</div>
          <div><div className="syne" style={{ fontWeight: 700, fontSize: 13.5 }}>TTMIP — Timber Intelligence</div><div style={{ fontSize: 9, color: T.text3, letterSpacing: '0.09em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace' }}>Ministry of Forests & Wildlife · Cameroon</div></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div title={live ? 'Connected to TTMIP API' : 'Offline demo data (API unreachable)'} style={{ display: 'flex', alignItems: 'center', gap: 5, background: live ? 'rgba(34,201,122,0.09)' : 'rgba(244,162,51,0.09)', border: `1px solid ${live ? T.green2 : T.accent2}33`, borderRadius: 20, padding: '4px 10px', fontSize: 10, color: live ? T.green2 : T.accent2, fontFamily: 'DM Mono, monospace' }}>
            <span style={{ width: 5, height: 5, background: live ? T.green2 : T.accent2, borderRadius: '50%' }} />{live ? 'LIVE' : 'DEMO'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: T.panel, border: `1px solid ${T.border2}`, borderRadius: 20, padding: '3px 10px 3px 3px' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>MF</div>
            <span style={{ fontSize: 11, fontWeight: 500 }}>Min. Forests</span>
          </div>
        </div>
      </div>

      {/* Ticker */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '5px 20px', overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: 'DM Mono, monospace', fontSize: 9.5 }}>
        {(data?.prices || []).slice(0, 16).map((p) => (
          <span key={p.id} style={{ marginRight: 26, color: T.text2 }}>{p.species}·{p.destination} <span style={{ color: T.text }}>${Math.round(p.price)}</span></span>
        ))}
      </div>

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '205px 1fr', minHeight: 'calc(100vh - 80px)' }}>
        <div style={{ background: T.surface, borderRight: `1px solid ${T.border}`, padding: '14px 0' }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.text3, padding: '10px 13px 4px', fontFamily: 'DM Mono, monospace' }}>Navigation</div>
          {TABS.map((t) => (
            <div key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', fontSize: 12, fontWeight: 500, color: tab === t.id ? T.accent : T.text2, cursor: 'pointer', margin: '1px 7px', borderRadius: 6, background: tab === t.id ? 'rgba(232,135,58,0.1)' : 'transparent', border: `1px solid ${tab === t.id ? 'rgba(232,135,58,0.18)' : 'transparent'}`, userSelect: 'none' }}>
              <span style={{ fontSize: 13, width: 16, textAlign: 'center' }}>{t.icon}</span>{t.label}
            </div>
          ))}
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflowX: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div className="syne" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{active?.icon} {active?.label}</div>
              <div style={{ fontSize: 11, color: T.text3, marginTop: 3 }}>30 Species · 15 Markets · 22 Live Platforms · SIGIF2 Interlink · 5 Regulatory Frameworks</div>
            </div>
          </div>
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
