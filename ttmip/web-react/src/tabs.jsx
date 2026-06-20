import React, { useMemo, useState } from 'react';
import { T, inputStyle } from './theme.js';
import { Badge, Card, Chip, KpiCard, Table, BarChart, Gauge, LineChart, CandleChart, CameroonMap } from './components.jsx';
import {
  MARKETS_15, SPECIES_30, REGULATIONS, BROKERS, PUBLICATIONS, ARTICLES, FAQ_DATA,
  SUPPLY_DEMAND, MACRO_DATA, SENTIMENT_NEWS, genIndex, genCandles,
} from './data.js';

/* ─────────────────────────── tone helpers ──────────────────────────── */
const sevTone = (s) => ({ High: 'red', Medium: 'yellow', Low: 'gold' }[s] || 'blue');
const riskTone = (r) => ({ Low: 'green', Medium: 'yellow', High: 'red', Critical: 'red', 'N/A': 'gray' }[r] || 'blue');
const statusTone = (s) => ({ Compliant: 'green', Active: 'green', 'Under Review': 'yellow', Expiring: 'yellow', 'Non-Compliant': 'red', Expired: 'red', Critical: 'red', 'No Cert': 'gray', Partial: 'yellow', TERMINATED: 'red' }[s] || 'blue');
const qualTone = (q) => (q === 'High' ? 'green' : q === 'Medium' ? 'yellow' : 'red');
const sentiTone = (s) => ({ positive: 'green', neutral: 'blue', negative: 'red' }[s] || 'blue');

/* ════════════════════════════ DASHBOARD ════════════════════════════ */
export function Dashboard({ data, setTab }) {
  const avg = useMemo(() => Math.round(data.prices.reduce((s, p) => s + p.price, 0) / data.prices.length), [data]);
  const counts = { High: data.alerts.filter((a) => a.severity === 'High').length, Medium: data.alerts.filter((a) => a.severity === 'Medium').length, Low: data.alerts.filter((a) => a.severity === 'Low').length };
  const topMarkets = [...MARKETS_15].sort((a, b) => b.volume - a.volume).slice(0, 6);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
        <KpiCard color={T.accent} label="Avg Timber Price" value={`$${avg}`} suffix="/m³" chg="+3.2%" chgUp meta="vs last month" icon="💰" onClick={() => setTab('prices')} />
        <KpiCard color={T.red} label="Forest Alerts" value={data.alerts.length} suffix=" active" chg={`${counts.High} High`} meta="priority" icon="🌲" onClick={() => setTab('alerts')} />
        <KpiCard color={T.blue} label="GSPI Index" value="124.7" chg="+1.8%" chgUp meta="Global Sawlog" icon="🌐" onClick={() => setTab('indices')} />
        <KpiCard color={T.green} label="Active Markets" value="15" suffix=" mkts" chg="+2 new" chgUp meta="this quarter" icon="🌍" onClick={() => setTab('markets')} />
        <KpiCard color={T.purple} label="Regulatory" value={REGULATIONS.length} suffix=" frwks" chg="3 changes" meta="this month" icon="⚖️" onClick={() => setTab('regulatory')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Card title="🌍 Top Markets by Volume"><BarChart items={topMarkets.map((m) => ({ label: `${m.flag} ${m.name}`, value: m.volume, display: m.volume.toLocaleString(), color: m.color }))} /></Card>
        <Card title="🛰️ Deforestation Alerts" actions={<Badge tone="red">● {counts.High} HIGH</Badge>}>
          <CameroonMap alerts={data.alerts} height={170} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 9.5, marginTop: 10 }}>
            {[['High', counts.High, T.red], ['Medium', counts.Medium, T.accent2], ['Low', counts.Low, T.gold2]].map(([l, v, c]) => (
              <div key={l}><div className="syne" style={{ color: c, fontSize: 18, fontWeight: 800 }}>{v}</div><div style={{ color: T.text3 }}>{l}</div></div>
            ))}
          </div>
        </Card>
      </div>
      <Card title="📋 Latest Prices — Multi-Platform">
        <Table maxHeight={300} rows={data.prices.slice(0, 30)} columns={[
          { key: 'species', label: 'Species' }, { key: 'platform', label: 'Platform' }, { key: 'destName', label: 'Destination' },
          { key: 'price', label: 'Price', align: 'right', render: (r) => `$${r.price}` },
          { key: 'volume', label: 'Volume', align: 'right', render: (r) => r.volume.toLocaleString() },
          { key: 'quality', label: 'Quality', render: (r) => <Badge tone={qualTone(r.quality)}>{r.quality}</Badge> },
        ]} />
      </Card>
    </>
  );
}

/* ════════════════════════════ PRICES ═══════════════════════════════ */
export function Prices({ data }) {
  const [q, setQ] = useState(''); const [qual, setQual] = useState('');
  const rows = data.prices.filter((p) => (!q || `${p.species} ${p.platform} ${p.destName}`.toLowerCase().includes(q.toLowerCase())) && (!qual || p.quality === qual));
  return (
    <Card title="📋 All Price Records" actions={<>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={inputStyle} />
      <select value={qual} onChange={(e) => setQual(e.target.value)} style={inputStyle}><option value="">All Quality</option><option>High</option><option>Medium</option><option>Low</option></select>
    </>}>
      <Table maxHeight={470} rows={rows} columns={[
        { key: 'id', label: '#' }, { key: 'species', label: 'Species' }, { key: 'platform', label: 'Platform' }, { key: 'destName', label: 'Destination' },
        { key: 'price', label: 'Price', align: 'right', render: (r) => `$${r.price}` },
        { key: 'volume', label: 'Volume m³', align: 'right', render: (r) => r.volume.toLocaleString() },
        { key: 'quality', label: 'Quality', render: (r) => <Badge tone={qualTone(r.quality)}>{r.quality}</Badge> },
      ]} />
      <div style={{ marginTop: 8, fontSize: 10, color: T.text3, fontFamily: 'DM Mono, monospace' }}>{rows.length} records</div>
    </Card>
  );
}

/* ════════════════════════════ MARKETS ══════════════════════════════ */
export function Markets() {
  const [sort, setSort] = useState('volume');
  const rows = [...MARKETS_15].sort((a, b) => b[sort] - a[sort]);
  return (
    <Card title="🌍 Market Performance — Cameroon Exports" actions={['volume', 'price', 'growth'].map((s) => <Chip key={s} active={sort === s} onClick={() => setSort(s)}>Sort: {s}</Chip>)}>
      <Table maxHeight={470} rows={rows} columns={[
        { key: 'name', label: 'Market', render: (r) => `${r.flag} ${r.name}` }, { key: 'region', label: 'Region' },
        { key: 'volume', label: 'Volume', align: 'right', render: (r) => r.volume.toLocaleString() },
        { key: 'price', label: 'Avg Price', align: 'right', render: (r) => `${r.curr === 'EUR' ? '€' : '$'}${r.price}` },
        { key: 'share', label: 'Share', align: 'right', render: (r) => `${r.share}%` },
        { key: 'growth', label: 'Growth', align: 'right', render: (r) => <Badge tone={r.growth >= 0 ? 'green' : 'red'}>{r.growth >= 0 ? '▲' : '▼'} {Math.abs(r.growth)}%</Badge> },
      ]} />
    </Card>
  );
}

/* ════════════════════════════ INDICES ══════════════════════════════ */
export function Indices() {
  const gspi = useMemo(() => genIndex(124.7, 0.9), []);
  const espi = useMemo(() => genIndex(106.3, 0.5), []);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <Card title="🌐 GSPI — Global Sawlog Price Index" actions={<Badge tone="blue">124.7 pts</Badge>}><LineChart series={gspi} color={T.accent} /></Card>
      <Card title="🇪🇺 ESPI — European Sawlog Price Index" actions={<Badge tone="blue">106.3 pts</Badge>}><LineChart series={espi} color={T.green2} /></Card>
    </div>
  );
}

/* ════════════════════════════ ESG ══════════════════════════════════ */
export function ESG({ data }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {data.esg.slice(0, 4).map((e) => (
          <Card key={e.company} pad>
            <div className="syne" style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: T.text }}>{e.company}</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}><Gauge value={e.env} color={T.green2} label="ENV" /><Gauge value={e.soc} color={T.blue2} label="SOC" /><Gauge value={e.gov} color={T.accent} label="GOV" /></div>
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

/* ════════════════════════════ CERTS ════════════════════════════════ */
export function Certs({ data }) {
  const [f, setF] = useState('');
  const rows = data.certs.filter((c) => !f || (f === 'expiring' ? c.status === 'Expiring' : c.type === f));
  return (
    <Card title="📜 Concession Certificates" actions={['', 'FSC', 'PEFC', 'expiring'].map((x) => <Chip key={x || 'all'} active={f === x} onClick={() => setF(x)}>{x === '' ? 'All' : x === 'expiring' ? '⚠ Expiring' : x}</Chip>)}>
      <Table maxHeight={470} rows={rows} columns={[
        { key: 'id', label: 'Concession' }, { key: 'name', label: 'Company' },
        { key: 'type', label: 'Type', render: (r) => <Badge tone={r.type === 'None' ? 'gray' : 'teal'}>{r.type}</Badge> },
        { key: 'issue', label: 'Issued' }, { key: 'expiry', label: 'Expires' }, { key: 'daysLeft', label: 'Days Left', align: 'right' },
        { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
      ]} />
    </Card>
  );
}

/* ════════════════════════════ ALERTS ═══════════════════════════════ */
export function Alerts({ data }) {
  const [f, setF] = useState('all');
  const rows = data.alerts.filter((a) => f === 'all' || a.severity === f);
  return (
    <>
      <Card title="🛰️ Alert Map — Cameroon" actions={['all', 'High', 'Medium', 'Low'].map((x) => <Chip key={x} active={f === x} onClick={() => setF(x)}>{x === 'all' ? 'All' : x}</Chip>)}>
        <CameroonMap alerts={rows} height={300} />
      </Card>
      <Card title="📋 Alert Records">
        <Table maxHeight={300} rows={rows} columns={[
          { key: 'id', label: 'Alert ID' }, { key: 'zone', label: 'Zone' }, { key: 'source', label: 'Source' }, { key: 'date', label: 'Date' },
          { key: 'area', label: 'Area ha', align: 'right' },
          { key: 'confidence', label: 'Conf.', align: 'right', render: (r) => `${(r.confidence * 100).toFixed(0)}%` },
          { key: 'severity', label: 'Severity', render: (r) => <Badge tone={sevTone(r.severity)}>{r.severity}</Badge> },
        ]} />
      </Card>
    </>
  );
}

/* ════════════════════════════ DDRA ═════════════════════════════════ */
export function DDRA({ data }) {
  const [f, setF] = useState('');
  const rows = data.ddra.filter((d) => !f || d.status === f);
  return (
    <Card title="🛡️ DDRA Records (EUDR)" actions={<select value={f} onChange={(e) => setF(e.target.value)} style={inputStyle}><option value="">All Statuses</option><option>Compliant</option><option>Under Review</option><option>Non-Compliant</option><option>Critical</option></select>}>
      <Table maxHeight={470} rows={rows} columns={[
        { key: 'id', label: 'Shipment' }, { key: 'company', label: 'Company' }, { key: 'date', label: 'Assessed' },
        { key: 'risk', label: 'Risk', align: 'right', render: (r) => r.risk.toFixed(1) },
        { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
      ]} />
    </Card>
  );
}

/* ════════════════════════════ REGULATORY ═══════════════════════════ */
export function Regulatory() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {REGULATIONS.map((r) => (
        <Card key={r.code}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18 }}>{r.flag}</span>
                <span className="syne" style={{ fontWeight: 800, fontSize: 14, color: T.text }}>{r.name}</span>
                <Badge tone={riskTone(r.risk)}>{r.risk} risk</Badge>
              </div>
              <div style={{ fontSize: 10.5, color: T.text3, marginBottom: 8 }}>{r.market} · {r.status}</div>
              <div style={{ fontSize: 11.5, color: T.text2, maxWidth: 720, lineHeight: 1.5 }}>{r.description}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: T.text3, fontFamily: 'DM Mono, monospace' }}>PRICE IMPACT</div>
              <div className="syne" style={{ fontSize: 20, fontWeight: 800, color: r.priceImpact < 0 ? T.red2 : T.green2 }}>{r.priceImpact}%</div>
              <div style={{ fontSize: 10, color: T.text3, marginTop: 4 }}>{r.complianceCost}</div>
              <div style={{ marginTop: 6 }}><Badge tone={statusTone(r.camStatus)}>CM: {r.camStatus}</Badge></div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ════════════════════════════ TRADING ══════════════════════════════ */
export function Trading() {
  const [broker, setBroker] = useState(BROKERS[0].id);
  const [species, setSpecies] = useState('Sapelli');
  const [market, setMarket] = useState('EU');
  const [side, setSide] = useState('BUY');
  const [qty, setQty] = useState(500);
  const candles = useMemo(() => genCandles(60, MARKETS_15.find((m) => m.code === market)?.price || 1000), [market]);
  const px = candles[candles.length - 1].c;
  const sel = BROKERS.find((b) => b.id === broker);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card title={`📊 ${species} / ${market}`} actions={<Badge tone="green">${px}/m³</Badge>}><CandleChart candles={candles} /></Card>
        <Card title="🏦 Partner Brokers">
          <Table maxHeight={220} rows={BROKERS} columns={[
            { key: 'name', label: 'Broker', render: (b) => <span><span style={{ color: b.color, fontWeight: 700 }}>{b.logo}</span> {b.name}</span> },
            { key: 'speciality', label: 'Speciality' }, { key: 'focus', label: 'Focus' },
            { key: 'commission', label: 'Comm.', align: 'right' },
            { key: 'rating', label: 'Rating', align: 'right', render: (b) => '★'.repeat(b.rating) },
          ]} />
        </Card>
      </div>
      <Card title="🎫 Order Ticket">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['BUY', 'SELL'].map((s) => <button key={s} onClick={() => setSide(s)} style={{ flex: 1, padding: '8px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer', border: `1px solid ${side === s ? (s === 'BUY' ? T.green2 : T.red2) : T.border}`, background: side === s ? (s === 'BUY' ? 'rgba(34,201,122,0.14)' : 'rgba(217,64,64,0.14)') : T.surface, color: side === s ? (s === 'BUY' ? T.green2 : T.red2) : T.text2 }}>{s}</button>)}
          </div>
          <Field label="Broker"><select value={broker} onChange={(e) => setBroker(e.target.value)} style={{ ...inputStyle, width: '100%' }}>{BROKERS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Species"><select value={species} onChange={(e) => setSpecies(e.target.value)} style={{ ...inputStyle, width: '100%' }}>{SPECIES_30.slice(0, 12).map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Market"><select value={market} onChange={(e) => setMarket(e.target.value)} style={{ ...inputStyle, width: '100%' }}>{MARKETS_15.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}</select></Field>
          <Field label="Quantity (m³)"><input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} style={{ ...inputStyle, width: '100%' }} /></Field>
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11 }}>
            <Row l="Unit price" v={`$${px}/m³`} />
            <Row l="Notional" v={`$${(px * qty).toLocaleString()}`} />
            <Row l={`Commission (${sel.commission})`} v={`$${Math.round(px * qty * parseFloat(sel.commission) / 100).toLocaleString()}`} />
          </div>
          <button style={{ padding: '10px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer', border: 'none', background: side === 'BUY' ? T.green2 : T.red2, color: '#06210f' }}>{side} {qty} m³ {species}</button>
          <div style={{ fontSize: 9, color: T.text3, textAlign: 'center', fontFamily: 'DM Mono, monospace' }}>Simulation — training environment</div>
        </div>
      </Card>
    </div>
  );
}
const Field = ({ label, children }) => <div><div style={{ fontSize: 9, color: T.text3, fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>{children}</div>;
const Row = ({ l, v }) => <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: T.text2 }}>{l}</span><span style={{ fontFamily: 'DM Mono, monospace', color: T.text }}>{v}</span></div>;

/* ════════════════════════════ TECHNICAL ════════════════════════════ */
export function Technical() {
  const [species, setSpecies] = useState('Sapelli');
  const candles = useMemo(() => genCandles(60, 1100), [species]);
  const closes = candles.map((c) => c.c);
  const last = closes[closes.length - 1];
  const sma = (n) => Math.round(closes.slice(-n).reduce((a, b) => a + b, 0) / n);
  const indicators = [
    { label: 'RSI (21)', value: (40 + (last % 35)).toFixed(1), tone: 'yellow', note: 'Neutral' },
    { label: 'SMA (20)', value: `$${sma(20)}`, tone: last > sma(20) ? 'green' : 'red', note: last > sma(20) ? 'Above' : 'Below' },
    { label: 'SMA (50)', value: `$${sma(50)}`, tone: last > sma(50) ? 'green' : 'red', note: last > sma(50) ? 'Bullish' : 'Bearish' },
    { label: 'MACD', value: (last - sma(20) > 0 ? '+' : '') + (last - sma(20)), tone: last - sma(20) > 0 ? 'green' : 'red', note: 'Weekly' },
    { label: 'Bollinger', value: 'Mid-band', tone: 'blue', note: 'Vol normal' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card title="📉 Price Action — Candles" actions={<select value={species} onChange={(e) => setSpecies(e.target.value)} style={inputStyle}>{SPECIES_30.slice(0, 12).map((s) => <option key={s}>{s}</option>)}</select>}>
        <CandleChart candles={candles} />
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
        {indicators.map((i) => <KpiCard key={i.label} color={T[i.tone === 'green' ? 'green2' : i.tone === 'red' ? 'red2' : i.tone === 'yellow' ? 'accent2' : 'blue2']} label={i.label} value={i.value} meta={i.note} />)}
      </div>
      <Card title="📌 Note">
        <div style={{ fontSize: 11.5, color: T.text2, lineHeight: 1.6 }}>Tropical timber lacks financial-market liquidity, so standard technical analysis has limited direct applicability. The most useful signals are moving averages (20/50-day) for momentum, RSI adapted to 21-day periods, Bollinger Bands for volatility regimes, and MACD on weekly data. Fundamental drivers (construction PMI, freight rates, EUDR timelines) remain more predictive than pure technical signals.</div>
      </Card>
    </div>
  );
}

/* ════════════════════════════ PUBLICATIONS ═════════════════════════ */
export function Publications() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card title="📰 Data Sources & Publications" pad>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {PUBLICATIONS.map((p) => (
            <a key={p.abbr} href={p.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 13, display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{p.emoji}</span>
                <div><div className="syne" style={{ fontWeight: 700, fontSize: 12, color: p.color }}>{p.name}</div><div style={{ fontSize: 9.5, color: T.text3, fontFamily: 'DM Mono, monospace' }}>{p.freq} · {p.focus}</div></div>
              </div>
              <div style={{ fontSize: 10.5, color: T.text2, lineHeight: 1.5 }}>{p.desc}</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>{p.tags.map((t) => <Badge key={t} tone="gray">{t}</Badge>)}</div>
            </a>
          ))}
        </div>
      </Card>
      <Card title="🗞️ Latest Articles">
        <Table maxHeight={320} rows={ARTICLES} columns={[
          { key: 'title', label: 'Headline', render: (a) => <span style={{ whiteSpace: 'normal' }}>{a.title}</span> },
          { key: 'source', label: 'Source' }, { key: 'date', label: 'Date' }, { key: 'topic', label: 'Topic' },
          { key: 'sentiment', label: 'Tone', render: (a) => <Badge tone={sentiTone(a.sentiment)}>{a.sentiment}</Badge> },
        ]} />
      </Card>
    </div>
  );
}

/* ════════════════════════════ FUNDAMENTALS ═════════════════════════ */
export function Fundamentals() {
  const SDList = ({ title, items, color }) => (
    <Card title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((s) => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
            <span style={{ color: T.text2 }}>{s.label}{s.note && <span style={{ color: T.text3, fontSize: 9 }}> · {s.note}</span>}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontFamily: 'DM Mono, monospace', color }}>{s.val}</span><span style={{ color: s.trend === 'up' ? T.green2 : s.trend === 'dn' ? T.red2 : T.text3 }}>{s.trend === 'up' ? '▲' : s.trend === 'dn' ? '▼' : '■'}</span></span>
          </div>
        ))}
      </div>
    </Card>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <SDList title="🌲 Supply Fundamentals" items={SUPPLY_DEMAND.supply} color={T.accent} />
        <SDList title="📦 Demand Fundamentals" items={SUPPLY_DEMAND.demand} color={T.green2} />
      </div>
      <Card title="🌐 Macro Indicators">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {MACRO_DATA.map((m) => <KpiCard key={m.label} color={m.trend === 'up' ? T.green2 : T.red2} label={m.label} value={m.val} suffix={` ${m.unit}`} chg={`${m.chg}`} chgUp={m.trend === 'up'} meta="" icon={m.icon} />)}
        </div>
      </Card>
    </div>
  );
}

/* ════════════════════════════ FAQ ══════════════════════════════════ */
export function FAQ() {
  const [open, setOpen] = useState(0);
  const [cat, setCat] = useState('');
  const cats = ['', ...new Set(FAQ_DATA.map((f) => f.cat))];
  const rows = FAQ_DATA.filter((f) => !cat || f.cat === cat);
  return (
    <Card title="❓ Frequently Asked Questions" actions={cats.map((c) => <Chip key={c || 'all'} active={cat === c} onClick={() => { setCat(c); setOpen(-1); }}>{c || 'All'}</Chip>)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((f, i) => (
          <div key={f.q} style={{ border: `1px solid ${T.border}`, borderRadius: 7, overflow: 'hidden' }}>
            <button onClick={() => setOpen(open === i ? -1 : i)} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: T.surface, border: 'none', color: T.text, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, fontWeight: 600 }}>
              <span><Badge tone="purple">{f.cat}</Badge> &nbsp;{f.q}</span><span style={{ color: T.text3 }}>{open === i ? '−' : '+'}</span>
            </button>
            {open === i && <div style={{ padding: '10px 12px', fontSize: 11.5, color: T.text2, lineHeight: 1.6, borderTop: `1px solid ${T.border}` }}>{f.a}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ════════════════════════════ AI INTELLIGENCE ══════════════════════ */
export function AIIntelligence({ data }) {
  const avg = Math.round(data.prices.reduce((s, p) => s + p.price, 0) / data.prices.length);
  const high = data.alerts.filter((a) => a.severity === 'High').length;
  const critDDRA = data.ddra.filter((d) => d.status === 'Critical' || d.status === 'Non-Compliant').length;
  const sentScore = Math.round((SENTIMENT_NEWS.filter((n) => n.sentiment === 'positive').length / SENTIMENT_NEWS.length) * 100);
  const insights = [
    { icon: '💰', tone: 'green', title: 'Price momentum positive', body: `Average price holding at $${avg}/m³ (+3.2% MoM). EU certified Sapelli commands a 35-55% premium over Asian destinations — prioritise FSC stock for EU contracts.` },
    { icon: '🛰️', tone: 'red', title: `${high} high-confidence deforestation alerts`, body: 'Elevated GFW activity around Lobéké NP raises EUDR risk flags. Shipments sourced near flagged zones should pre-empt due-diligence escalation.' },
    { icon: '⚖️', tone: 'purple', title: 'FLEGT pathway closed', body: 'With the VPA terminated (30 Nov 2025), all EU-bound exports require independent EUDR due diligence incl. GPS harvest coordinates. Budget +$18-35/m³ compliance cost.' },
    { icon: '🛡️', tone: 'yellow', title: `${critDDRA} shipments need review`, body: 'DDRA flags non-compliant/critical shipments. Resolve traceability gaps before the 30 Dec 2026 EUDR application date.' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <KpiCard color={T.green2} label="Market Sentiment" value={`${sentScore}%`} chg="bullish" chgUp meta="news-weighted" icon="🤖" />
        <KpiCard color={T.accent} label="Avg Price Signal" value={`$${avg}`} suffix="/m³" chg="+3.2%" chgUp meta="momentum" icon="📈" />
        <KpiCard color={T.red2} label="Risk Alerts" value={high} suffix=" high" meta="EUDR exposure" icon="⚠️" />
        <KpiCard color={T.purple2} label="Compliance Gap" value={critDDRA} suffix=" ships" meta="need review" icon="🛡️" />
      </div>
      <Card title="🤖 AI-Generated Insights">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map((i) => (
            <div key={i.title} style={{ display: 'flex', gap: 10, padding: 11, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }}>
              <div style={{ fontSize: 20 }}>{i.icon}</div>
              <div><div className="syne" style={{ fontWeight: 700, fontSize: 12, marginBottom: 3, color: T.text }}>{i.title}</div><div style={{ fontSize: 11, color: T.text2, lineHeight: 1.5 }}>{i.body}</div></div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="📰 Market Sentiment Feed">
        <Table maxHeight={260} rows={SENTIMENT_NEWS} columns={[
          { key: 'title', label: 'Signal', render: (n) => <span style={{ whiteSpace: 'normal' }}>{n.title}</span> },
          { key: 'source', label: 'Source' }, { key: 'date', label: 'Date' },
          { key: 'impact', label: 'Impact', render: (n) => <Badge tone={n.impact === 'High' ? 'red' : 'yellow'}>{n.impact}</Badge> },
          { key: 'sentiment', label: 'Tone', render: (n) => <Badge tone={sentiTone(n.sentiment)}>{n.sentiment}</Badge> },
        ]} />
      </Card>
    </div>
  );
}
