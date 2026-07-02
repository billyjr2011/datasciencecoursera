/**
 * Dynamic FOB (Free On Board, Douala) price calculation for Cameroonian timber.
 *
 * Works backwards from live international market prices:
 *
 *   FOB Douala = CIF destination
 *              − ocean freight (per m³, destination-specific)
 *              − marine insurance (% of CIF)
 *              − destination compliance cost (EUDR/Lacey/CITES etc., per m³)
 *              − importer/trader margin (% of CIF)
 *
 * The CIF anchor is the volume-weighted average of recent live PriceRecords for
 * the species/destination (falling back to the market baseline), adjusted by a
 * quality factor. Every component is returned so the number is auditable.
 */
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/httpError.js';

export interface FobBreakdown {
  species: string;
  destination: string;
  destName: string;
  quality: 'High' | 'Medium' | 'Low';
  sampleSize: number; // live records used for the CIF anchor
  cifAnchor: number; // USD/m³ observed destination price
  qualityFactor: number;
  adjustedCif: number;
  freight: number;
  insurance: number;
  compliance: number;
  traderMargin: number;
  fobDouala: number; // USD/m³
  fobXaf: number; // FCFA/m³
  computedAt: string;
}

const QUALITY_FACTOR = { High: 1.0, Medium: 0.88, Low: 0.72 } as const;

// USD per m³ ocean freight Douala → destination region (40ft container basis).
const FREIGHT_BY_REGION: Record<string, number> = {
  EU: 96,
  Asia: 118,
  USA: 132,
  Other: 104,
};

// Regulatory compliance cost per m³ by destination region (documentation,
// due-diligence, permits). EU carries the EUDR burden.
const COMPLIANCE_BY_REGION: Record<string, number> = {
  EU: 26, // EUDR DDS + GPS traceability (midpoint of $18–35)
  USA: 9, // Lacey Act declarations
  Asia: 4,
  Other: 6,
};

const INSURANCE_RATE = 0.012; // 1.2% of CIF
const TRADER_MARGIN_RATE = 0.07; // 7% importer margin
const USD_XAF = 585; // XAF is EUR-pegged; refresh via FX feed in production

export async function calculateFob(input: {
  species: string;
  destination: string; // market code
  quality?: 'High' | 'Medium' | 'Low';
}): Promise<FobBreakdown> {
  const quality = input.quality ?? 'High';

  const market = await prisma.market.findUnique({ where: { code: input.destination } });
  if (!market) throw HttpError.notFound(`Unknown destination market ${input.destination}`);
  const species = await prisma.species.findUnique({ where: { name: input.species } });
  if (!species) throw HttpError.notFound(`Unknown species ${input.species}`);

  // CIF anchor: volume-weighted mean of the most recent live quotes.
  const recent = await prisma.priceRecord.findMany({
    where: { speciesId: species.id, marketId: market.id },
    orderBy: { recordedAt: 'desc' },
    take: 25,
  });
  const totalVol = recent.reduce((a, r) => a + r.volume, 0);
  const cifAnchor = recent.length
    ? recent.reduce((a, r) => a + r.price * r.volume, 0) / totalVol
    : market.price;

  const qualityFactor = QUALITY_FACTOR[quality];
  const adjustedCif = cifAnchor * qualityFactor;
  const freight = FREIGHT_BY_REGION[market.region] ?? FREIGHT_BY_REGION.Other!;
  const insurance = adjustedCif * INSURANCE_RATE;
  const compliance = COMPLIANCE_BY_REGION[market.region] ?? COMPLIANCE_BY_REGION.Other!;
  const traderMargin = adjustedCif * TRADER_MARGIN_RATE;
  const fobDouala = Math.max(0, adjustedCif - freight - insurance - compliance - traderMargin);

  const r2 = (n: number) => +n.toFixed(2);
  return {
    species: species.name,
    destination: market.code,
    destName: market.name,
    quality,
    sampleSize: recent.length,
    cifAnchor: r2(cifAnchor),
    qualityFactor,
    adjustedCif: r2(adjustedCif),
    freight: r2(freight),
    insurance: r2(insurance),
    compliance: r2(compliance),
    traderMargin: r2(traderMargin),
    fobDouala: r2(fobDouala),
    fobXaf: Math.round(fobDouala * USD_XAF),
    computedAt: new Date().toISOString(),
  };
}

/** FOB across all destinations for a species — the comparison matrix. */
export async function fobMatrix(speciesName: string, quality?: 'High' | 'Medium' | 'Low') {
  const markets = await prisma.market.findMany({ orderBy: { volume: 'desc' } });
  const rows = [];
  for (const m of markets) {
    rows.push(await calculateFob({ species: speciesName, destination: m.code, quality }));
  }
  return rows.sort((a, b) => b.fobDouala - a.fobDouala);
}
