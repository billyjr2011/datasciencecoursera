/**
 * Seeds the timber-intelligence domain with the reference data carried over
 * from the TTMIP v8 prototype, plus deterministically-generated observations
 * (prices, alerts, ESG, certificates, DDRA) and index time series.
 *
 * Deterministic: a seeded PRNG makes every run reproducible, so demos and tests
 * are stable.
 */
import { PrismaClient, Quality, AlertSeverity, EsgRisk, CertType, CertStatus, DdraStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const hashPassword = (plain: string) => bcrypt.hash(plain, 12);

// ── Seeded PRNG (mulberry32) for reproducible data ──────────
let _s = 0x9e3779b9;
const rand = () => {
  _s |= 0;
  _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rnd = (a: number, b: number) => +(rand() * (b - a) + a).toFixed(2);
const rndI = (a: number, b: number) => Math.floor(rand() * (b - a + 1) + a);
const pick = <T>(arr: readonly T[]): T => arr[rndI(0, arr.length - 1)]!;
const DAY = 86_400_000;

const SPECIES_30 = [
  'Sapelli', 'Ayous', 'Azobé', 'Iroko', 'Padouk', 'Dibetou', 'Bilinga', 'Frake', 'Movingui', 'Mahogany',
  'Tali', 'Doussié', 'Wengé', 'Bubinga', 'Ebène', 'Moabi', 'Tiama', 'Longhi', 'Niové', 'Ilomba',
  'Bokassa', 'Sipo', 'Tchitola', 'Landa', 'Eyong', 'Naga', 'Mukulungu', 'Panga-Panga', 'Ozigo', 'Limbali',
];

const MARKETS_15 = [
  { code: 'EU', name: 'European Union', flag: '🇪🇺', color: '#3A9FE8', currency: 'EUR', volume: 3820, price: 1180, growth: 2.1, share: 28.4, region: 'EU' },
  { code: 'FR', name: 'France', flag: '🇫🇷', color: '#4A90D9', currency: 'EUR', volume: 2140, price: 1220, growth: 1.8, share: 15.9, region: 'EU' },
  { code: 'CN', name: 'China', flag: '🇨🇳', color: '#D94040', currency: 'USD', volume: 4100, price: 780, growth: 5.4, share: 30.5, region: 'Asia' },
  { code: 'IN', name: 'India', flag: '🇮🇳', color: '#E87F3A', currency: 'USD', volume: 980, price: 590, growth: 8.2, share: 7.3, region: 'Asia' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', color: '#D94040', currency: 'USD', volume: 1240, price: 680, growth: 12.1, share: 9.2, region: 'Asia' },
  { code: 'US', name: 'United States', flag: '🇺🇸', color: '#2272C3', currency: 'USD', volume: 870, price: 1050, growth: 0.9, share: 6.5, region: 'USA' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', color: '#27AE60', currency: 'EUR', volume: 620, price: 1160, growth: 1.2, share: 4.6, region: 'EU' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', color: '#F4A233', currency: 'EUR', volume: 540, price: 1140, growth: 0.8, share: 4.0, region: 'EU' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', color: '#D94040', currency: 'USD', volume: 480, price: 510, growth: 3.7, share: 3.6, region: 'Other' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', color: '#2272C3', currency: 'USD', volume: 310, price: 1280, growth: -1.1, share: 2.3, region: 'Asia' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', color: '#3A9FE8', currency: 'USD', volume: 260, price: 1050, growth: 2.4, share: 1.9, region: 'Asia' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', color: '#27AE60', currency: 'USD', volume: 190, price: 720, growth: 4.1, share: 1.4, region: 'Asia' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', color: '#E87F3A', currency: 'EUR', volume: 450, price: 1110, growth: 1.5, share: 3.3, region: 'EU' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', color: '#27AE60', currency: 'USD', volume: 220, price: 940, growth: 6.3, share: 1.6, region: 'Other' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪', color: '#7B52C8', currency: 'USD', volume: 180, price: 980, growth: 9.2, share: 1.3, region: 'Other' },
];

// 22 international market platforms TTMIP ingests (see src/ingestion/connectors.ts)
const PLATFORMS = [
  { name: 'Fastmarkets', region: 'Global', feedType: 'REST', url: 'https://www.fastmarkets.com/forest-products', pollSeconds: 300 },
  { name: 'ITTO MIS', region: 'Global', feedType: 'REST', url: 'https://www.itto.int/market_information_service', pollSeconds: 1800 },
  { name: 'Timber Exchange', region: 'Global', feedType: 'REST', url: 'https://www.timberexchange.com', pollSeconds: 300 },
  { name: 'BVRio', region: 'LATAM', feedType: 'REST', url: 'https://www.bvrio.org', pollSeconds: 900 },
  { name: 'Hardwood Review', region: 'USA', feedType: 'SFTP', url: 'https://hardwoodreview.com', pollSeconds: 3600 },
  { name: 'WoodMarket', region: 'EU', feedType: 'SCRAPE', url: 'https://woodmarket.eu', pollSeconds: 900 },
  { name: 'GlobalWood', region: 'Global', feedType: 'SCRAPE', url: 'https://www.globalwood.org', pollSeconds: 1800 },
  { name: 'Lesprom Network', region: 'CIS/EU', feedType: 'REST', url: 'https://www.lesprom.com', pollSeconds: 900 },
  { name: 'TimberWeb', region: 'Global', feedType: 'REST', url: 'https://www.timberweb.com', pollSeconds: 900 },
  { name: 'Wood Resources Intl', region: 'Global', feedType: 'SFTP', url: 'https://woodprices.com', pollSeconds: 3600 },
  { name: 'Forest2Market', region: 'USA', feedType: 'REST', url: 'https://www.forest2market.com', pollSeconds: 1800 },
  { name: 'RISI Fastmarkets', region: 'Global', feedType: 'REST', url: 'https://www.risiinfo.com', pollSeconds: 1800 },
  { name: 'UN Comtrade', region: 'Global', feedType: 'REST', url: 'https://comtradeplus.un.org', pollSeconds: 86400 },
  { name: 'Eurostat COMEXT', region: 'EU', feedType: 'REST', url: 'https://ec.europa.eu/eurostat/comext', pollSeconds: 86400 },
  { name: 'ITC TradeMap', region: 'Global', feedType: 'REST', url: 'https://www.trademap.org', pollSeconds: 86400 },
  { name: 'Panjiva S&P', region: 'Global', feedType: 'REST', url: 'https://panjiva.com', pollSeconds: 3600 },
  { name: 'Timbeter', region: 'Global', feedType: 'REST', url: 'https://timbeter.com', pollSeconds: 900 },
  { name: 'Open Timber Portal', region: 'Congo Basin', feedType: 'REST', url: 'https://opentimberportal.org', pollSeconds: 3600 },
  { name: 'ATIBT Market Watch', region: 'Congo Basin', feedType: 'SCRAPE', url: 'https://www.atibt.org', pollSeconds: 3600 },
  { name: 'CommoPrices', region: 'Global', feedType: 'REST', url: 'https://commoprices.com', pollSeconds: 900 },
  { name: 'IHB Timber Exchange', region: 'EU', feedType: 'SCRAPE', url: 'https://www.ihb.de', pollSeconds: 900 },
  { name: 'Vietnam Timber Assoc', region: 'Asia', feedType: 'SCRAPE', url: 'https://goviet.org.vn', pollSeconds: 3600 },
];

const PLANS = [
  { code: 'FREE', name: 'Community', audience: 'Students, researchers, observers', priceUsd: 0, maxSeats: 1, apiRateLimit: 30, feedDelayMins: 60, features: ['Delayed prices (60 min)', 'Dashboard & indices', 'FAQ & publications'] },
  { code: 'PRODUCER', name: 'Producer', audience: 'Concession holders & sawmills', priceUsd: 149, maxSeats: 5, apiRateLimit: 120, feedDelayMins: 15, features: ['SIGIF2 quota view', 'FOB calculator', '15-min delayed feeds', 'ESG & certification tracking'] },
  { code: 'TRADER_PRO', name: 'Trader Pro', audience: 'Exporters, importers & trading desks', priceUsd: 449, maxSeats: 20, apiRateLimit: 600, feedDelayMins: 0, features: ['Real-time 22-platform feeds', 'FOB matrix & projections', 'Trading desk & technical analysis', 'API access'] },
  { code: 'ENTERPRISE', name: 'Enterprise / Regulator', audience: 'Ministries, banks, large groups', priceUsd: 1490, maxSeats: 999, apiRateLimit: 3000, feedDelayMins: 0, features: ['Everything in Trader Pro', 'SIGIF2 write-back interlink', 'Custom compliance reports', 'Dedicated support & SLA'] },
];

// SIGIF2 quota mirror — concessions (UFA) with annual allowable cut.
const SIGIF_QUOTAS = [
  { concession: 'UFA 10-052', titleHolder: 'Pallisco', speciesName: 'Sapelli', yearlyQuota: 18500, usedVolume: 11200, permitNumber: 'CAM-2026-0113' },
  { concession: 'UFA 10-052', titleHolder: 'Pallisco', speciesName: 'Ayous', yearlyQuota: 24200, usedVolume: 9800, permitNumber: 'CAM-2026-0114' },
  { concession: 'UFA 09-024', titleHolder: 'Wijma Cameroon', speciesName: 'Azobé', yearlyQuota: 12800, usedVolume: 7400, permitNumber: 'CAM-2026-0087' },
  { concession: 'UFA 09-024', titleHolder: 'Wijma Cameroon', speciesName: 'Tali', yearlyQuota: 9600, usedVolume: 3100, permitNumber: 'CAM-2026-0088' },
  { concession: 'UFA 00-004', titleHolder: 'Alpicam', speciesName: 'Iroko', yearlyQuota: 7400, usedVolume: 5900, permitNumber: 'CAM-2026-0031' },
  { concession: 'UFA 00-004', titleHolder: 'Alpicam', speciesName: 'Doussié', yearlyQuota: 4200, usedVolume: 2050, permitNumber: 'CAM-2026-0032' },
  { concession: 'UFA 10-030', titleHolder: 'SFID', speciesName: 'Sipo', yearlyQuota: 8900, usedVolume: 4300, permitNumber: 'CAM-2026-0156' },
  { concession: 'UFA 10-030', titleHolder: 'SFID', speciesName: 'Sapelli', yearlyQuota: 15300, usedVolume: 12750, permitNumber: 'CAM-2026-0157' },
  { concession: 'UFA 08-011', titleHolder: 'GRUMCAM', speciesName: 'Padouk', yearlyQuota: 6800, usedVolume: 1900, permitNumber: 'CAM-2026-0064' },
  { concession: 'UFA 08-011', titleHolder: 'GRUMCAM', speciesName: 'Movingui', yearlyQuota: 5200, usedVolume: 2600, permitNumber: 'CAM-2026-0065' },
  { concession: 'UFA 11-005', titleHolder: 'SIM', speciesName: 'Frake', yearlyQuota: 16700, usedVolume: 8200, permitNumber: 'CAM-2026-0178' },
  { concession: 'UFA 11-005', titleHolder: 'SIM', speciesName: 'Bilinga', yearlyQuota: 5900, usedVolume: 5900, permitNumber: 'CAM-2026-0179' },
  { concession: 'UFA 10-047', titleHolder: 'FIPCAM', speciesName: 'Wengé', yearlyQuota: 2400, usedVolume: 950, permitNumber: 'CAM-2026-0142' },
  { concession: 'UFA 10-047', titleHolder: 'FIPCAM', speciesName: 'Moabi', yearlyQuota: 3100, usedVolume: 1400, permitNumber: 'CAM-2026-0143' },
];
const COMPANIES = ['Société Forestière', 'Pallisco', 'Wijma Cameroon', 'Alpicam', 'SFID', 'GRUMCAM', 'SIM', 'FIPCAM'];

const REGULATIONS = [
  {
    code: 'EUDR', name: 'EUDR',
    fullName: 'EU Deforestation Regulation — Reg. (EU) 2023/1115 as amended by Reg. (EU) 2025/2650',
    flag: '🇪🇺', market: 'European Union', region: 'EU', status: 'ACTIVE — enforcement Dec 2026',
    effectiveDate: '2026-12-30', lastChange: '2025-12-23', priceImpact: -12.4, complianceCost: '+$18-35/m³',
    risk: 'Critical', complianceRate: 58, camStatus: 'Partial',
    description: 'Reg. (EU) 2023/1115 bans placing on the EU market any timber from land deforested after 31 December 2020. Reg. (EU) 2025/2650 postponed application dates: large/medium operators 30 Dec 2026; micro/small operators 30 Jun 2027. Introduces a downstream-operator category that need only collect DDS reference numbers.',
    keyRequirements: [
      'GPS geolocation coordinates for each plot of land where commodities were produced',
      'Due diligence statement (DDS) submitted via EU TRACES NT Information System',
      'Supply chain traceability to country and sub-national region of production',
      'Deforestation-free evidence: land not deforested after 31 December 2020',
    ],
    tags: [{ l: 'Large/Med: 30 Dec 2026', c: 'red' }, { l: 'Micro/Small: 30 Jun 2027', c: 'orange' }, { l: 'GPS Required', c: 'yellow' }],
    timeline: [
      { y: '29 Jun 2023', t: 'Reg. (EU) 2023/1115 enters into force' },
      { y: '26 Dec 2025', t: 'Reg. (EU) 2025/2650 enters into force — new deadlines binding' },
      { y: '30 Dec 2026', t: 'Application date — large and medium operators' },
      { y: '30 Jun 2027', t: 'Application date — micro and small operators' },
    ],
  },
  {
    code: 'EUTR', name: 'EUTR', fullName: 'EU Timber Regulation — Reg. (EU) 995/2010',
    flag: '🇪🇺', market: 'European Union', region: 'EU', status: 'Operative until 30 Dec 2026 — then repealed by EUDR',
    effectiveDate: '2013-03-03', lastChange: '2026-12-30', priceImpact: -6.2, complianceCost: '+$8-15/m³',
    risk: 'Medium', complianceRate: 78, camStatus: 'Compliant',
    description: 'Reg. (EU) 995/2010 prohibits operators from placing illegally harvested timber on the EU market and requires a due-diligence system (information, risk assessment, mitigation). Remains the operative EU legality obligation until 30 December 2026, when it is repealed and replaced by the EUDR.',
    keyRequirements: [
      'Operator due diligence system: information, risk assessment, risk mitigation',
      'Prohibition on placing illegally harvested timber on EU market',
      'Record keeping: minimum 5 years',
    ],
    tags: [{ l: 'Operative until 30 Dec 2026', c: 'yellow' }, { l: 'Repealed by EUDR', c: 'gray' }],
    timeline: [
      { y: '3 Mar 2013', t: 'EUTR enters application' },
      { y: '30 Dec 2026', t: 'EUTR formally repealed — EUDR takes full effect' },
    ],
  },
  {
    code: 'FLEGT', name: 'FLEGT VPA — TERMINATED',
    fullName: 'EU-Cameroon FLEGT Voluntary Partnership Agreement — ceased 30 November 2025',
    flag: '🇨🇲', market: 'European Union (historical)', region: 'EU', status: 'TERMINATED — 30 Nov 2025',
    effectiveDate: '2011-12-01', lastChange: '2025-11-30', priceImpact: 0, complianceCost: 'N/A',
    risk: 'N/A', complianceRate: 0, camStatus: 'TERMINATED',
    description: 'The EU-Cameroon FLEGT VPA aimed to create a licensing scheme under which Cameroonian timber would be presumed legal. The scheme was never operationalised. Council Decision (EU) 2025/1976 approved termination; the VPA ceased on 30 November 2025. Consequence: Cameroon has no simplified EUDR compliance pathway.',
    keyRequirements: [
      'VPA ceased 30 November 2025 — no new rights or obligations',
      'EUDR compliance is now fully independent — no FLEGT licence simplification',
      'GPS-verified deforestation-free harvest evidence required for all EU shipments',
    ],
    tags: [{ l: 'TERMINATED 30 Nov 2025', c: 'red' }, { l: 'No EUDR simplified path', c: 'red' }],
    timeline: [
      { y: '1 Dec 2011', t: 'VPA entered into force' },
      { y: '17 Jun 2025', t: 'European Parliament voted 583–78 to approve termination' },
      { y: '30 Nov 2025', t: 'VPA ceased to apply' },
    ],
  },
  {
    code: 'LACEY', name: 'Lacey Act', fullName: 'US Lacey Act — 16 U.S.C. §§ 3371–3378 (amended 2008)',
    flag: '🇺🇸', market: 'United States', region: 'USA', status: 'Active — amendments pending',
    effectiveDate: '2008-05-22', lastChange: '2024-12-01', priceImpact: -4.8, complianceCost: '+$6-12/m³',
    risk: 'Medium', complianceRate: 71, camStatus: 'Compliant',
    description: 'The Lacey Act prohibits trade in illegally sourced plants and plant products, requiring import declarations (PPQ Form 505) with species and country of harvest. Enforced through a strict-liability standard with due-care defence.',
    keyRequirements: [
      'PPQ Form 505 import declaration: genus, species, country of harvest, quantity, value',
      'Due care across the supply chain',
      'Strict-liability standard for illegally sourced material',
    ],
    tags: [{ l: 'Import Declaration', c: 'yellow' }, { l: 'Strict Liability', c: 'red' }],
    timeline: [
      { y: '22 May 2008', t: 'Plant amendments enter into force' },
      { y: '2024', t: 'Phase VII enforcement schedule expansion' },
    ],
  },
  {
    code: 'CITES', name: 'CITES', fullName: 'Convention on International Trade in Endangered Species',
    flag: '🌍', market: 'Global', region: 'Other', status: 'Active',
    effectiveDate: '1975-07-01', lastChange: '2025-11-01', priceImpact: -3.1, complianceCost: '+$4-9/m³',
    risk: 'Medium', complianceRate: 82, camStatus: 'Compliant',
    description: 'CITES regulates international trade in listed species through permits. Several tropical hardwoods (e.g. certain Bubinga, Wengé populations) are Appendix II listed, requiring export permits and non-detriment findings.',
    keyRequirements: [
      'CITES export permit for Appendix II listed species',
      'Non-detriment finding by the Scientific Authority',
      'Annual export quotas where established',
    ],
    tags: [{ l: 'Appendix II Species', c: 'yellow' }, { l: 'Export Permit', c: 'blue' }],
    timeline: [
      { y: '1 Jul 1975', t: 'Convention enters into force' },
      { y: 'Nov 2025', t: 'New Wengé quotas effective' },
    ],
  },
];

// ── Index series (GSPI / ESPI), 36 monthly points each ──────
function buildSeries(base: number, drift: number, months = 36) {
  const points: { date: Date; value: number }[] = [];
  let v = base * 0.85;
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    v = v * (1 + drift / 100) + (rand() - 0.5) * 2.5;
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({ date: d, value: +v.toFixed(1) });
  }
  return points;
}

async function main() {
  console.log('🌱 Seeding TTMIP…');

  // Clean slate (respect FK order via cascades on parents).
  await prisma.subscription.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.sigifQuota.deleteMany();
  await prisma.priceRecord.deleteMany();
  await prisma.indexPoint.deleteMany();
  await prisma.priceIndex.deleteMany();
  await prisma.esgScore.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.deforestationAlert.deleteMany();
  await prisma.ddraRecord.deleteMany();
  await prisma.regulation.deleteMany();
  await prisma.species.deleteMany();
  await prisma.market.deleteMany();
  await prisma.platform.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();

  // Demo user (Enterprise subscriber)
  const demoUser = await prisma.user.create({
    data: {
      email: 'analyst@minfof.cm',
      name: 'MINFOF Analyst',
      organization: 'Ministry of Forests & Wildlife',
      role: 'REGULATOR',
      passwordHash: await hashPassword('password123'),
    },
  });

  // Reference data
  await prisma.species.createMany({ data: SPECIES_30.map((name) => ({ name })) });
  await prisma.market.createMany({ data: MARKETS_15 });
  await prisma.platform.createMany({ data: PLATFORMS });
  await prisma.company.createMany({ data: COMPANIES.map((name) => ({ name })) });
  await prisma.regulation.createMany({ data: REGULATIONS });

  // Subscription plans + demo subscription
  await prisma.subscriptionPlan.createMany({ data: PLANS });
  const enterprise = await prisma.subscriptionPlan.findUnique({ where: { code: 'ENTERPRISE' } });
  await prisma.subscription.create({
    data: { userId: demoUser.id, planId: enterprise!.id, status: 'ACTIVE', renewsAt: new Date(Date.now() + 365 * DAY) },
  });

  // SIGIF2 quota mirror
  await prisma.sigifQuota.createMany({
    data: SIGIF_QUOTAS.map((q) => ({
      ...q,
      availableM3: q.yearlyQuota - q.usedVolume,
      validUntil: new Date(Date.now() + 200 * DAY),
    })),
  });

  const species = await prisma.species.findMany();
  const markets = await prisma.market.findMany();
  const platforms = await prisma.platform.findMany();
  const companies = await prisma.company.findMany();

  // Prices (200)
  const priceRows = Array.from({ length: 200 }, () => {
    const r = rand();
    const quality: Quality = r < 0.68 ? Quality.HIGH : r < 0.88 ? Quality.MEDIUM : Quality.LOW;
    return {
      platformId: pick(platforms).id,
      speciesId: pick(species).id,
      marketId: pick(markets).id,
      price: rnd(420, 1450),
      volume: rndI(80, 9000),
      quality,
      recordedAt: new Date(Date.now() - rndI(0, 3600) * 1000),
    };
  });
  await prisma.priceRecord.createMany({ data: priceRows });

  // Indices
  const gspi = await prisma.priceIndex.create({
    data: { code: 'GSPI', name: 'Global Sawlog Price Index', description: 'Worldwide sawlog price benchmark' },
  });
  const espi = await prisma.priceIndex.create({
    data: { code: 'ESPI', name: 'European Sawlog Price Index', description: 'European sawlog price benchmark' },
  });
  await prisma.indexPoint.createMany({ data: buildSeries(124.7, 0.9).map((p) => ({ ...p, indexId: gspi.id })) });
  await prisma.indexPoint.createMany({ data: buildSeries(106.3, 0.5).map((p) => ({ ...p, indexId: espi.id })) });

  // ESG (per company)
  await prisma.esgScore.createMany({
    data: companies.map((c) => {
      const env = rndI(38, 92);
      const soc = rndI(40, 90);
      const gov = rndI(32, 85);
      const overall = +((env + soc + gov) / 3).toFixed(1);
      const risk: EsgRisk =
        overall >= 70 ? EsgRisk.LOW : overall >= 50 ? EsgRisk.MEDIUM : overall >= 30 ? EsgRisk.HIGH : EsgRisk.CRITICAL;
      return { companyId: c.id, env, soc, gov, overall, risk, assessedAt: new Date(Date.now() - rndI(1, 90) * DAY) };
    }),
  });

  // Certificates (50)
  await prisma.certificate.createMany({
    data: Array.from({ length: 50 }, (_, i) => {
      const issuedAt = new Date(Date.now() - rndI(30, 1095) * DAY);
      const expiresAt = new Date(issuedAt.getTime() + 3 * 365 * DAY);
      const daysLeft = Math.round((expiresAt.getTime() - Date.now()) / DAY);
      const type = pick([CertType.FSC, CertType.PEFC, CertType.BOTH, CertType.NONE]);
      const status: CertStatus =
        type === CertType.NONE ? CertStatus.NONE : daysLeft > 90 ? CertStatus.ACTIVE : daysLeft > 0 ? CertStatus.EXPIRING : CertStatus.EXPIRED;
      return { code: `CONC-${String(i + 1).padStart(3, '0')}`, companyId: pick(companies).id, type, issuedAt, expiresAt, status };
    }),
  });

  // Deforestation alerts (30)
  const zones = ['Lobéké NP', 'Dja Reserve', "Campo-Ma'an", 'Ngoyla-Mintom', 'Mbam & Djerem', 'Bénoué NP', 'Waza NP', 'Boumba-Bek', 'Takamanda NR', 'Korup NP'];
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  await prisma.deforestationAlert.createMany({
    data: Array.from({ length: 30 }, (_, i) => {
      const confidence = rnd(0.3, 0.98);
      const severity: AlertSeverity = confidence >= 0.8 ? AlertSeverity.HIGH : confidence >= 0.5 ? AlertSeverity.MEDIUM : AlertSeverity.LOW;
      return {
        code: `ALERT-${today}-${String(i + 1).padStart(3, '0')}`,
        lat: rnd(2, 13), lng: rnd(8, 16), confidence,
        alertDate: new Date(Date.now() - rndI(1, 30) * DAY),
        areaHa: rnd(0.1, 25), source: pick(['GFW', 'WRI', 'NASA', 'EU JRC']), zone: pick(zones), severity,
      };
    }),
  });

  // DDRA (100)
  const ym = new Date().toISOString().slice(0, 7).replace('-', '');
  await prisma.ddraRecord.createMany({
    data: Array.from({ length: 100 }, (_, i) => {
      const riskScore = rnd(0, 10);
      const status: DdraStatus =
        riskScore <= 3 ? DdraStatus.COMPLIANT : riskScore <= 6 ? DdraStatus.UNDER_REVIEW : riskScore <= 8 ? DdraStatus.NON_COMPLIANT : DdraStatus.CRITICAL;
      return { code: `SHIP-${ym}-${String(i + 1).padStart(4, '0')}`, companyId: pick(companies).id, riskScore, status, assessedAt: new Date(Date.now() - rndI(1, 60) * DAY) };
    }),
  });

  console.log('✅ Seed complete: 30 species · 15 markets · 22 platforms · 4 plans · SIGIF2 quotas');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
