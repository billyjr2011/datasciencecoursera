import React from 'react';
import { T } from './theme.js';

/* ─────────────────────────────── Badge ─────────────────────────────── */
const TONES = {
  green: [T.green2, 'rgba(34,201,122,0.12)'], yellow: [T.accent2, 'rgba(244,162,51,0.12)'],
  red: [T.red2, 'rgba(217,64,64,0.12)'], blue: [T.blue2, 'rgba(58,159,232,0.12)'],
  purple: [T.purple2, 'rgba(123,82,200,0.12)'], gold: [T.gold2, 'rgba(212,162,42,0.12)'],
  teal: [T.teal2, 'rgba(30,207,176,0.12)'], gray: [T.text2, 'rgba(106,145,176,0.12)'],
};
export const Badge = ({ tone = 'green', children }) => {
  const [c, bg] = TONES[tone] || TONES.green;
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 3, fontSize: 9, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: c, background: bg, border: `1px solid ${c}33`, whiteSpace: 'nowrap' }}>{children}</span>;
};

/* ─────────────────────────────── Card ──────────────────────────────── */
export const Card = ({ title, actions, children, pad = true }) => (
  <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
    {title && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 15px', borderBottom: `1px solid ${T.border}`, gap: 8 }}>
        <div className="syne" style={{ fontSize: 12, fontWeight: 700 }}>{title}</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>
      </div>
    )}
    <div style={pad ? { padding: '13px 15px' } : undefined}>{children}</div>
  </div>
);

/* ─────────────────────────────── Chip ──────────────────────────────── */
export const Chip = ({ active, onClick, tone = 'accent', children }) => {
  const c = tone === 'purple' ? T.purple2 : T.accent;
  return (
    <button onClick={onClick} style={{ background: active ? `${c}14` : T.surface, border: `1px solid ${active ? c : T.border}`, color: active ? c : T.text3, borderRadius: 4, padding: '3px 8px', fontSize: 9.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>{children}</button>
  );
};

/* ────────────────────────────── KpiCard ────────────────────────────── */
export const KpiCard = ({ color, label, value, suffix, chg, chgUp, meta, icon, onClick }) => (
  <div onClick={onClick} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px', position: 'relative', overflow: 'hidden', cursor: onClick ? 'pointer' : 'default' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
    <div style={{ fontSize: 9, color: T.text3, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', marginBottom: 7 }}>{label}</div>
    <div className="syne" style={{ fontSize: 23, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 6, color: T.text }}>{value}<span style={{ fontSize: 12, opacity: 0.5 }}>{suffix}</span></div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
      {chg != null && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 5px', borderRadius: 3, fontFamily: 'DM Mono, monospace', color: chgUp ? T.green2 : T.red2, background: chgUp ? 'rgba(34,201,122,0.13)' : 'rgba(217,64,64,0.13)' }}>{chgUp ? '▲' : '▼'} {chg}</span>}
      <span style={{ color: T.text3 }}>{meta}</span>
    </div>
    <div style={{ position: 'absolute', right: 12, bottom: 10, fontSize: 26, opacity: 0.18 }}>{icon}</div>
  </div>
);

/* ─────────────────────────────── Table ─────────────────────────────── */
export const Table = ({ columns, rows, maxHeight = 360 }) => (
  <div style={{ overflow: 'auto', maxHeight }}>
    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
      <thead>
        <tr>{columns.map((c) => <th key={c.key} style={{ textAlign: c.align || 'left', fontSize: 8.5, fontWeight: 700, color: T.text3, letterSpacing: '0.11em', textTransform: 'uppercase', padding: '6px 8px', borderBottom: `1px solid ${T.border}`, fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: T.panel }}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id ?? i}>{columns.map((c) => <td key={c.key} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(25,36,51,0.7)', textAlign: c.align || 'left', whiteSpace: 'nowrap', color: T.text }}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={columns.length} style={{ padding: 20, textAlign: 'center', color: T.text3 }}>No records</td></tr>}
      </tbody>
    </table>
  </div>
);

/* ───────────────────────────── BarChart ────────────────────────────── */
export const BarChart = ({ items }) => {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 9.5, color: T.text2, fontFamily: 'DM Mono, monospace', width: 96, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</div>
          <div style={{ flex: 1, height: 8, background: T.border, borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(it.value / max) * 100}%`, background: it.color || T.accent, borderRadius: 5, transition: 'width .9s' }} />
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: T.text2, width: 64, textAlign: 'right', fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>{it.display ?? it.value}</div>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────── Gauge ─────────────────────────────── */
export const Gauge = ({ value, color, label }) => {
  const r = 24, circ = 2 * Math.PI * r, off = circ * (1 - value / 100);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <svg viewBox="0 0 64 64" width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="32" cy="32" r={r} fill="none" stroke={T.border2} strokeWidth="6" />
          <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color, fontFamily: 'Syne, sans-serif' }}>{value}</div>
      </div>
      <div style={{ fontSize: 8.5, color: T.text3, fontFamily: 'DM Mono, monospace', marginTop: 4 }}>{label}</div>
    </div>
  );
};

/* ───────────────────────────── LineChart ───────────────────────────── */
export const LineChart = ({ series, color, height = 220 }) => {
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
      {series.map((p, i) => i % 6 === 0 ? <text key={i} x={xOf(i)} y={h - 8} fontSize="8" fill={T.text3} textAnchor="middle" fontFamily="DM Mono, monospace">{p.date}</text> : null)}
    </svg>
  );
};

/* ─────────────────────────── CandleChart ───────────────────────────── */
export const CandleChart = ({ candles, height = 240 }) => {
  const w = 640, h = height, pad = 30;
  const hi = Math.max(...candles.map((c) => c.h)), lo = Math.min(...candles.map((c) => c.l));
  const span = hi - lo || 1;
  const yOf = (v) => h - pad - ((v - lo) / span) * (h - pad * 2);
  const bw = (w - pad * 2) / candles.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }}>
      {candles.map((c, i) => {
        const x = pad + i * bw + bw / 2;
        const up = c.c >= c.o;
        const col = up ? T.green2 : T.red2;
        return (
          <g key={i}>
            <line x1={x} y1={yOf(c.h)} x2={x} y2={yOf(c.l)} stroke={col} strokeWidth="1" />
            <rect x={x - bw * 0.32} y={yOf(Math.max(c.o, c.c))} width={bw * 0.64} height={Math.max(1, Math.abs(yOf(c.o) - yOf(c.c)))} fill={col} />
          </g>
        );
      })}
    </svg>
  );
};

/* ───────────────────── Cameroon deforestation map ──────────────────── */
const SEV_COLOR = { High: '#D94040', Medium: '#F4A233', Low: '#F1C40F' };
const SEV_SIZE = { High: 20, Medium: 14, Low: 10 };
export const CameroonMap = ({ alerts, height = 320 }) => (
  <div style={{ position: 'relative', height, background: '#050B12', borderRadius: 8, overflow: 'hidden' }}>
    <svg viewBox="0 0 600 310" style={{ width: '100%', height: '100%', opacity: 0.7 }} preserveAspectRatio="xMidYMid slice">
      <rect width="600" height="310" fill="#050B12" />
      <path d="M155,50 L345,30 L445,70 L485,150 L465,250 L405,310 L300,320 L230,320 L170,300 L130,270 L110,230 L92,180 L100,120 Z" fill="rgba(0,122,94,0.15)" stroke="rgba(0,122,94,0.35)" strokeWidth="2" />
    </svg>
    {alerts.map((a) => {
      const left = ((a.lng - 8) / 8) * 84 + 8;
      const top = ((a.lat - 2) / 11) * 84 + 8;
      const col = SEV_COLOR[a.severity], sz = SEV_SIZE[a.severity];
      return (
        <div key={a.id} title={`${a.zone} — ${(a.confidence * 100).toFixed(0)}% · ${a.area} ha · ${a.source} · ${a.date}`}
          style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: sz, height: sz, marginLeft: -sz / 2, marginTop: -sz / 2, background: `${col}66`, border: `2px solid ${col}`, borderRadius: '50%', cursor: 'pointer' }} />
      );
    })}
    <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 12, fontSize: 9, color: T.text2, fontFamily: 'DM Mono, monospace' }}>
      {Object.entries(SEV_COLOR).map(([k, c]) => (
        <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{k}</span>
      ))}
    </div>
  </div>
);
