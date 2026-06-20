/*
 * Domain data, content, deterministic generators, and the API client.
 * Reference + content arrays are ported faithfully from the TTMIP v8 prototype.
 */

/* ─────────────────────────── Reference data ────────────────────────── */
export const SPECIES_30 = [
  'Sapelli', 'Ayous', 'Azobé', 'Iroko', 'Padouk', 'Dibetou', 'Bilinga', 'Frake', 'Movingui', 'Mahogany',
  'Tali', 'Doussié', 'Wengé', 'Bubinga', 'Ebène', 'Moabi', 'Tiama', 'Longhi', 'Niové', 'Ilomba',
  'Bokassa', 'Sipo', 'Tchitola', 'Landa', 'Eyong', 'Naga', 'Mukulungu', 'Panga-Panga', 'Ozigo', 'Limbali',
];

export const MARKETS_15 = [
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

export const PLATFORMS = ['Fastmarkets', 'ITTO MIS', 'Timber Exchange', 'BVRio', 'Hardwood Review', 'WoodMarket'];
export const COMPANIES = ['Société Forestière', 'Pallisco', 'Wijma Cameroon', 'Alpicam', 'SFID', 'GRUMCAM', 'SIM', 'FIPCAM'];

export const REGULATIONS = [
  { code: 'EUDR', name: 'EUDR', flag: '🇪🇺', market: 'European Union', status: 'ACTIVE — enforcement Dec 2026', risk: 'Critical', priceImpact: -12.4, complianceRate: 58, camStatus: 'Partial', complianceCost: '+$18-35/m³', description: 'Bans EU placement of timber from land deforested after 31 Dec 2020. Large/medium operators 30 Dec 2026; micro/small 30 Jun 2027. Requires GPS geolocation + DDS via EU TRACES NT.' },
  { code: 'EUTR', name: 'EUTR', flag: '🇪🇺', market: 'European Union', status: 'Operative until 30 Dec 2026', risk: 'Medium', priceImpact: -6.2, complianceRate: 78, camStatus: 'Compliant', complianceCost: '+$8-15/m³', description: 'Prohibits illegally harvested timber on the EU market; requires operator due-diligence system. Repealed and replaced by EUDR on 30 Dec 2026.' },
  { code: 'FLEGT', name: 'FLEGT VPA — TERMINATED', flag: '🇨🇲', market: 'EU (historical)', status: 'TERMINATED — 30 Nov 2025', risk: 'N/A', priceImpact: 0, complianceRate: 0, camStatus: 'TERMINATED', complianceCost: 'N/A', description: 'EU-Cameroon VPA ceased 30 Nov 2025 (Council Decision 2025/1976). Cameroon now has no simplified EUDR pathway — full independent due-diligence required.' },
  { code: 'LACEY', name: 'Lacey Act', flag: '🇺🇸', market: 'United States', status: 'Active — amendments pending', risk: 'Medium', priceImpact: -4.8, complianceRate: 71, camStatus: 'Compliant', complianceCost: '+$6-12/m³', description: 'Prohibits trade in illegally sourced plants; requires PPQ Form 505 import declarations with species + country of harvest. Strict-liability with due-care defence.' },
  { code: 'CITES', name: 'CITES', flag: '🌍', market: 'Global', status: 'Active', risk: 'Medium', priceImpact: -3.1, complianceRate: 82, camStatus: 'Compliant', complianceCost: '+$4-9/m³', description: 'Regulates trade in listed species via permits. Several tropical hardwoods (Bubinga, Wengé) are Appendix II — export permits + non-detriment findings required.' },
];

/* ─────────────────────────── Content data ──────────────────────────── */
export const BROKERS = [
  { id: 'rabo', name: 'Rabobank Commodity', logo: 'RB', color: '#E8873A', rating: 5, commission: '0.15%', minOrder: 500, speciality: 'Agricultural commodities', focus: 'EU markets', founded: 1898, license: 'DNB/ECB regulated' },
  { id: 'sg', name: 'Société Générale Nat.', logo: 'SG', color: '#E74C3C', rating: 5, commission: '0.18%', minOrder: 200, speciality: 'Natural resources', focus: 'Africa/Asia', founded: 1864, license: 'ACPR/AMF regulated' },
  { id: 'bnp', name: 'BNP Paribas Trade', logo: 'BP', color: '#2272C3', rating: 4, commission: '0.20%', minOrder: 300, speciality: 'Trade finance', focus: 'Global', founded: 1848, license: 'ACPR/AMF regulated' },
  { id: 'stnd', name: 'Standard Chartered', logo: 'SC', color: '#22C97A', rating: 4, commission: '0.22%', minOrder: 100, speciality: 'Emerging markets', focus: 'Asia/Africa', founded: 1853, license: 'FCA/MAS regulated' },
  { id: 'ific', name: 'IFC Markets', logo: 'IF', color: '#7B52C8', rating: 4, commission: '0.12%', minOrder: 50, speciality: 'Online brokerage', focus: 'All markets', founded: 2006, license: 'CySEC regulated' },
];

export const PUBLICATIONS = [
  { name: 'ITTO Tropical Timber Market Report', abbr: 'ITTO MIS', color: '#22C97A', emoji: '🌿', freq: 'Bi-weekly', focus: 'Price data, trade flows, market analysis', url: 'https://www.itto.int/market_information_service/', desc: 'The authoritative bi-weekly publication from the International Tropical Timber Organization. Covers prices for 35+ tropical timber species across major markets.', tags: ['Price Data', 'Official', 'Free'] },
  { name: 'Fastmarkets Forest Products', abbr: 'Fastmarkets', color: '#E8873A', emoji: '📈', freq: 'Daily', focus: 'Real-time prices, futures, analytics', url: 'https://www.fastmarkets.com/forest-products/', desc: 'Professional daily price assessments and market intelligence for the global forest products industry, including tropical hardwoods.', tags: ['Subscription', 'Real-time', 'Analytics'] },
  { name: 'Forest Trends Publications', abbr: 'Forest Trends', color: '#3A9FE8', emoji: '🌳', freq: 'Monthly', focus: 'Trade finance, illegal logging, policy', url: 'https://www.forest-trends.org/', desc: 'Leading research and analysis on sustainable forest finance, timber trade flows, and illegal logging tracking across tropical regions.', tags: ['Research', 'Free', 'Policy'] },
  { name: 'CIFOR CGIAR Forestry', abbr: 'CIFOR', color: '#A07EEF', emoji: '🔬', freq: 'Quarterly', focus: 'Scientific research, governance', url: 'https://www.cifor-icraf.org/', desc: 'Center for International Forestry Research. Peer-reviewed studies on Cameroon forest governance, certification effectiveness, and supply chains.', tags: ['Scientific', 'Free', 'Peer-reviewed'] },
  { name: 'Global Forest Watch', abbr: 'GFW', color: '#D94040', emoji: '🛰️', freq: 'Real-time', focus: 'Deforestation alerts, forest cover', url: 'https://www.globalforestwatch.org/', desc: 'Real-time satellite monitoring of global forest cover. Primary source for TTMIP deforestation alerts and biodiversity risk assessments.', tags: ['Real-time', 'Free', 'Satellite'] },
  { name: 'Mongabay Conservation News', abbr: 'Mongabay', color: '#1ECFB0', emoji: '🐾', freq: 'Daily', focus: 'Environmental news, investigations', url: 'https://news.mongabay.com/', desc: 'Authoritative environmental journalism covering deforestation, illegal logging investigations, EUDR compliance, and forest governance.', tags: ['News', 'Free', 'Investigations'] },
  { name: 'FAO Forestry Statistics', abbr: 'FAO', color: '#D4A22A', emoji: '📊', freq: 'Annual', focus: 'Global forest statistics, country profiles', url: 'https://www.fao.org/forestry/en/', desc: 'UN Food and Agriculture Organization annual forestry data. Definitive source for national production, trade, and area statistics.', tags: ['Official', 'Free', 'UN Data'] },
];

export const ARTICLES = [
  { title: 'EUDR Compliance Costs Lower Than Feared — But Execution Challenges Remain', source: 'Mongabay', date: '2025-03-18', topic: 'Regulation', sentiment: 'neutral', excerpt: 'A Profundo report finds compliance cost increases between 0.001% and 0.07%, far below industry estimates, but traceability gaps persist.' },
  { title: 'EU-Cameroon FLEGT VPA Terminated: What It Means for Timber Exports', source: 'FERN', date: '2025-07-25', topic: 'Regulation', sentiment: 'negative', excerpt: 'The June 2025 termination marks a shift in EU-Africa forest governance, with major implications for market access and EUDR compliance.' },
  { title: 'Cameroon Sawnwood Exports 2022: Vietnam Overtakes Belgium as Top Buyer', source: 'OEC/COMTRADE', date: '2023-08-01', topic: 'Cameroon', sentiment: 'positive', excerpt: 'OEC data shows Vietnam ($99M), Belgium ($80.3M) and China ($72.8M) as top three destinations for Cameroon sawnwood in 2022.' },
  { title: 'Tropical Timber Market Report: EU27 Imports Fall 14% in 2024', source: 'ITTO', date: '2025-02-28', topic: 'Market Prices', sentiment: 'negative', excerpt: 'EU tropical sawnwood imports hit second-lowest level on record at 726,000 m³, driven by EUDR uncertainty and weak construction demand.' },
  { title: 'FSC 2.0 Standard: Implications for Cameroon Certified Concessions', source: 'FSC', date: '2024-09-01', topic: 'Sustainability', sentiment: 'neutral', excerpt: 'Revised FSC Principles introduce tighter requirements on Free Prior and Informed Consent and conversion of natural forests.' },
  { title: 'China Tropical Hardwood Demand: Shifting from Hongmu to Structural Uses', source: 'ITTO', date: '2024-10-15', topic: 'Market Prices', sentiment: 'positive', excerpt: 'Post-Hongmu regulation, Chinese buyers shift toward structural and flooring applications, supporting sustained Cameroon demand.' },
  { title: 'Vietnam Becomes Largest Importer of Cameroon Logs — 25% of Total', source: 'European Parliament', date: '2025-06-17', topic: 'Cameroon', sentiment: 'neutral', excerpt: 'EP documents confirm Vietnam 25% share of Cameroon log imports by value 2016-2019, raising legality and traceability concerns.' },
  { title: 'Timber Trade Finance: Green Bonds and Sustainability-Linked Loans', source: 'Forest Trends', date: '2025-04-10', topic: 'Trade Finance', sentiment: 'positive', excerpt: 'New blended finance instruments for sustainable tropical timber chains offer preferential rates for FSC/PEFC certified operators.' },
];

export const FAQ_DATA = [
  { cat: 'Platform', q: 'What is TTMIP and who is it designed for?', a: 'TTMIP (Tropical Timber Market Intelligence Platform) is a professional-grade analytics platform developed for the Cameroonian Ministry of Forests and Wildlife (MINFOF). It serves timber market analysts, policy makers, exporters, trade finance specialists, and sustainability officers needing comprehensive, real-time intelligence on tropical timber markets, pricing, regulations, and environmental compliance.' },
  { cat: 'Platform', q: 'What data sources does TTMIP use?', a: 'TTMIP integrates six primary sources: Fastmarkets (price data), ITTO Market Information Service (bi-weekly price reports), SPOTT/WWF (ESG assessments), BVRio (supply chain risk), Global Forest Watch (deforestation alerts), and EUR-Lex/EUDR (regulatory compliance). Trade volumes derive from UN Comtrade and OEC.' },
  { cat: 'Platform', q: 'How often is data refreshed?', a: 'Price data auto-refreshes every 5 minutes. Deforestation alerts sync in near-real-time from GFW satellite feeds. ITTO market reports are ingested bi-weekly. ESG and certification data update quarterly.' },
  { cat: 'Markets', q: 'Why is China consistently the largest buyer of Cameroon timber?', a: 'China dominates due to its massive construction sector, the Hongmu luxury furniture tradition driving demand for Bubinga and Wengé, and fewer regulatory barriers than EU markets. China and Vietnam account for over 30% of Cameroon sawnwood exports by value. Chinese buyers also accept lower-grade timber that EU markets reject.' },
  { cat: 'Markets', q: 'Why are EU prices higher despite lower volumes?', a: 'EU buyers pay 35-55% premiums above Asian prices because: (1) verified legal provenance and chain-of-custody documentation are required; (2) higher-grade, kiln-dried sawnwood is procured; and (3) EUDR/EUTR compliance costs are built into FOB prices.' },
  { cat: 'Regulation', q: 'What is the EUDR and when does it apply to timber?', a: 'EU Deforestation Regulation (EU 2023/1115) bans placing timber on the EU market if it comes from land deforested after 31 December 2020. Large/medium operators comply by 30 Dec 2026; micro/small by 30 Jun 2027. Exporters must provide GPS harvest plot coordinates, due diligence statements, and risk assessments.' },
  { cat: 'Regulation', q: 'Is Cameroon FLEGT VPA still valid for EUDR compliance?', a: 'No. The EU-Cameroon FLEGT VPA was formally terminated 30 November 2025 by Council Decision (EU) 2025/1976. The licensing scheme was never operationalized. Cameroon exporters targeting EU markets must now comply with EUDR due diligence independently.' },
  { cat: 'ESG', q: 'How are ESG scores calculated for timber companies?', a: 'TTMIP adapts the SPOTT methodology from WWF/ZSL. Environmental covers certification, deforestation commitments, biodiversity, carbon. Social covers community rights, worker safety, grievance mechanisms. Governance covers board independence, anti-corruption, supply chain transparency. Scores update quarterly from public disclosures.' },
];

export const SUPPLY_DEMAND = {
  supply: [
    { label: 'Annual harvest volume', val: '~4.2M m³', trend: 'dn', note: 'ITTO 2023' },
    { label: 'FSC certified area', val: '38% of concessions', trend: 'up', note: 'Growing' },
    { label: 'Illegal logging share', val: '~45% domestic', trend: 'dn', note: 'CIFOR est.' },
    { label: 'Seasonal variability', val: '±22% wet season', trend: 'neutral' },
    { label: 'Export processing ratio', val: '61% semi-processed', trend: 'up' },
    { label: 'Available species', val: '30 commercial', trend: 'neutral' },
  ],
  demand: [
    { label: 'EU tropical sawnwood imports', val: '726K m³/yr', trend: 'dn', note: 'ITTO 2024' },
    { label: 'China hardwood demand', val: '+5.4% YoY', trend: 'up' },
    { label: 'Vietnam reprocessing demand', val: '+12.1% YoY', trend: 'up' },
    { label: 'Global green construction', val: '+8% premium', trend: 'up' },
    { label: 'EU EUDR compliance demand', val: 'Certified only', trend: 'neutral' },
    { label: 'Middle East luxury demand', val: '+6.3% UAE', trend: 'up' },
  ],
};

export const MACRO_DATA = [
  { label: 'China Construction PMI', val: '52.3', unit: 'pts', chg: '+1.2', trend: 'up', icon: '🏗️' },
  { label: 'EU Green Building Permits', val: '+8.4', unit: '% YoY', chg: '+2.1', trend: 'up', icon: '🏛️' },
  { label: 'Container Freight Rate', val: '3,840', unit: '$/40ft', chg: '-8.2', trend: 'dn', icon: '🚢' },
  { label: 'EUR/USD Exchange Rate', val: '1.085', unit: 'rate', chg: '+0.3', trend: 'up', icon: '💱' },
  { label: 'WTI Crude Oil', val: '72.4', unit: '$/bbl', chg: '-1.4', trend: 'dn', icon: '⛽' },
  { label: 'Cameroon CPI Inflation', val: '3.7', unit: '%', chg: '-3.7', trend: 'dn', icon: '📉' },
];

export const SENTIMENT_NEWS = [
  { title: 'EUDR enforcement signals strength — EU buyers increase certified timber orders', sentiment: 'positive', source: 'Fastmarkets', date: '2026-05-01', impact: 'High' },
  { title: 'China construction activity rebounds Q1 2026 — tropical hardwood demand lifts', sentiment: 'positive', source: 'ITTO', date: '2026-04-28', impact: 'High' },
  { title: 'Container freight rates soften 8% from peak — margin relief for exporters', sentiment: 'positive', source: 'Fastmarkets', date: '2026-04-18', impact: 'Medium' },
  { title: 'Cameroon FLEGT VPA termination creates EU market access uncertainty', sentiment: 'negative', source: 'FERN', date: '2026-04-10', impact: 'High' },
  { title: 'GFW alerts: above-average deforestation in Lobéké NP raises EUDR risk flags', sentiment: 'negative', source: 'GFW', date: '2026-05-02', impact: 'High' },
  { title: 'CITES Bubinga quota review may tighten Cameroon export volumes', sentiment: 'negative', source: 'CITES', date: '2026-03-30', impact: 'Medium' },
];

/* ─────────────────────── Deterministic generators ──────────────────── */
let _s = 0x9e3779b9;
const rand = () => { _s = (_s + 0x6d2b79f5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const rnd = (a, b) => +(rand() * (b - a) + a).toFixed(2);
export const rndI = (a, b) => Math.floor(rand() * (b - a + 1) + a);
const pick = (arr) => arr[rndI(0, arr.length - 1)];
const DAY = 86_400_000;

export const genPrices = (n = 200) => Array.from({ length: n }, (_, i) => {
  const m = pick(MARKETS_15); const r = rand();
  return { id: i + 1, platform: pick(PLATFORMS), species: pick(SPECIES_30), destination: m.code, destName: m.name, price: rnd(420, 1450), volume: rndI(80, 9000), quality: r < 0.68 ? 'High' : r < 0.88 ? 'Medium' : 'Low', ts: new Date(Date.now() - rndI(0, 3600) * 1000) };
});
export const genAlerts = (n = 30) => {
  const zones = ['Lobéké NP', 'Dja Reserve', "Campo-Ma'an", 'Ngoyla-Mintom', 'Mbam & Djerem', 'Bénoué NP', 'Waza NP', 'Boumba-Bek', 'Takamanda NR', 'Korup NP'];
  return Array.from({ length: n }, (_, i) => {
    const confidence = rnd(0.3, 0.98);
    return { id: `ALERT-${String(i + 1).padStart(3, '0')}`, lat: rnd(2, 13), lng: rnd(8, 16), confidence, date: new Date(Date.now() - rndI(1, 30) * DAY).toISOString().slice(0, 10), area: rnd(0.1, 25), source: pick(['GFW', 'WRI', 'NASA', 'EU JRC']), zone: pick(zones), severity: confidence >= 0.8 ? 'High' : confidence >= 0.5 ? 'Medium' : 'Low' };
  });
};
export const genESG = () => COMPANIES.map((c) => {
  const env = rndI(38, 92), soc = rndI(40, 90), gov = rndI(32, 85);
  const overall = +((env + soc + gov) / 3).toFixed(1);
  return { company: c, env, soc, gov, overall, risk: overall >= 70 ? 'Low' : overall >= 50 ? 'Medium' : overall >= 30 ? 'High' : 'Critical', date: new Date(Date.now() - rndI(1, 90) * DAY).toISOString().slice(0, 10) };
});
export const genCerts = (n = 50) => Array.from({ length: n }, (_, i) => {
  const issue = new Date(Date.now() - rndI(30, 1095) * DAY);
  const expiry = new Date(issue.getTime() + 3 * 365 * DAY);
  const daysLeft = Math.round((expiry - Date.now()) / DAY);
  const type = pick(['FSC', 'PEFC', 'Both', 'None']);
  return { id: `CONC-${String(i + 1).padStart(3, '0')}`, name: pick(COMPANIES), type, issue: issue.toISOString().slice(0, 10), expiry: expiry.toISOString().slice(0, 10), daysLeft, status: type === 'None' ? 'No Cert' : daysLeft > 90 ? 'Active' : daysLeft > 0 ? 'Expiring' : 'Expired' };
});
export const genDDRA = (n = 100) => Array.from({ length: n }, (_, i) => {
  const risk = rnd(0, 10);
  return { id: `SHIP-${String(i + 1).padStart(4, '0')}`, company: pick(COMPANIES), risk, date: new Date(Date.now() - rndI(1, 60) * DAY).toISOString().slice(0, 10), status: risk <= 3 ? 'Compliant' : risk <= 6 ? 'Under Review' : risk <= 8 ? 'Non-Compliant' : 'Critical' };
});
export const genIndex = (base, drift, n = 36) => { let v = base * 0.85; return Array.from({ length: n }, (_, i) => { v = v * (1 + drift / 100) + (rand() - 0.5) * 2.5; const d = new Date(); d.setMonth(d.getMonth() - (n - 1 - i)); return { date: d.toISOString().slice(0, 7), value: +v.toFixed(1) }; }); };
export const genCandles = (n = 60, base = 1000) => {
  let price = base;
  return Array.from({ length: n }, () => {
    const o = price, change = rnd(-30, 35);
    const c = Math.max(200, o + change);
    const h = Math.max(o, c) + Math.abs(rnd(5, 40));
    const l = Math.min(o, c) - Math.abs(rnd(5, 40));
    price = Math.max(300, c);
    return { o: +o.toFixed(0), h: +h.toFixed(0), l: +l.toFixed(0), c: +c.toFixed(0), v: rndI(200, 3000) };
  });
};

/* ──────────────────────────── API client ───────────────────────────── */
export function makeApi(apiBase) {
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
