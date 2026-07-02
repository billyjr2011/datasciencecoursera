/**
 * Market-feed ingestion for the 22 international timber platforms.
 *
 * Every platform is accessed through the same `PlatformConnector` interface, so
 * swapping a simulated adapter for a real one (REST pull, SFTP drop, EDI, or
 * licensed API) is a one-file change that touches nothing downstream. Until
 * credentials for the commercial feeds are provisioned, each connector runs in
 * simulation mode: it emits deterministic, platform-flavoured quotes anchored
 * to each destination market's baseline price so analytics behave realistically.
 */
import { Quality } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface PlatformQuote {
  species: string;
  marketCode: string;
  price: number; // USD/m³
  volume: number; // m³
  quality: Quality;
  recordedAt: Date;
}

export interface PlatformConnector {
  /** Platform name — must match `platforms.name` in the DB. */
  name: string;
  /** Pull the latest quotes from the upstream feed. */
  fetchQuotes(): Promise<PlatformQuote[]>;
}

/** The 22 platforms TTMIP ingests, with feed metadata used for seeding. */
export const PLATFORM_DIRECTORY = [
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
] as const;

/* ── Simulated adapter ─────────────────────────────────────────────── */

// Deterministic per-platform PRNG so replays are reproducible in tests/demos.
function seeded(seedStr: string) {
  let s = [...seedStr].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0x9e3779b9);
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class SimulatedConnector implements PlatformConnector {
  constructor(public readonly name: string) {}

  async fetchQuotes(): Promise<PlatformQuote[]> {
    const [species, markets] = await Promise.all([
      prisma.species.findMany({ select: { name: true } }),
      prisma.market.findMany({ select: { code: true, price: true } }),
    ]);
    if (!species.length || !markets.length) return [];

    const rand = seeded(this.name + new Date().toISOString().slice(0, 13)); // hourly variation
    const n = 3 + Math.floor(rand() * 5); // 3–7 quotes per pull
    return Array.from({ length: n }, () => {
      const sp = species[Math.floor(rand() * species.length)]!;
      const mk = markets[Math.floor(rand() * markets.length)]!;
      const r = rand();
      return {
        species: sp.name,
        marketCode: mk.code,
        // anchor around the market baseline ±18% with platform-specific noise
        price: +(mk.price * (0.82 + rand() * 0.36)).toFixed(2),
        volume: 80 + Math.floor(rand() * 8920),
        quality: r < 0.68 ? Quality.HIGH : r < 0.88 ? Quality.MEDIUM : Quality.LOW,
        recordedAt: new Date(),
      };
    });
  }
}

/* ── Registry + sync ───────────────────────────────────────────────── */

export function getConnector(name: string): PlatformConnector {
  // Real adapters slot in here keyed by name (e.g. new FastmarketsRest(apiKey)).
  return new SimulatedConnector(name);
}

/** Pull one platform's feed and persist the quotes. Returns records written. */
export async function syncPlatform(name: string): Promise<number> {
  const platform = await prisma.platform.findUnique({ where: { name } });
  if (!platform) return 0;

  try {
    const quotes = await getConnector(name).fetchQuotes();
    let written = 0;
    for (const q of quotes) {
      const [sp, mk] = await Promise.all([
        prisma.species.findUnique({ where: { name: q.species } }),
        prisma.market.findUnique({ where: { code: q.marketCode } }),
      ]);
      if (!sp || !mk) continue;
      await prisma.priceRecord.create({
        data: {
          platformId: platform.id,
          speciesId: sp.id,
          marketId: mk.id,
          price: q.price,
          volume: q.volume,
          quality: q.quality,
          recordedAt: q.recordedAt,
        },
      });
      written += 1;
    }
    await prisma.platform.update({
      where: { id: platform.id },
      data: { lastSyncAt: new Date(), status: 'LIVE', recordCount: { increment: written } },
    });
    return written;
  } catch (err) {
    logger.warn({ err, platform: name }, 'Feed sync failed');
    await prisma.platform.update({ where: { id: platform.id }, data: { status: 'DOWN' } });
    return 0;
  }
}

/** Sync every platform once (used by the scheduler and the manual trigger). */
export async function syncAllPlatforms(): Promise<{ platform: string; written: number }[]> {
  const platforms = await prisma.platform.findMany({ select: { name: true } });
  const results = [];
  for (const p of platforms) {
    results.push({ platform: p.name, written: await syncPlatform(p.name) });
  }
  return results;
}

let timer: ReturnType<typeof setInterval> | undefined;

/** Start the background ingestion loop (env-gated from index.ts). */
export function startIngestionScheduler(intervalMs = 300_000): void {
  if (timer) return;
  timer = setInterval(() => {
    syncAllPlatforms()
      .then((r) => logger.info({ written: r.reduce((a, x) => a + x.written, 0) }, 'Feed sync cycle complete'))
      .catch((err) => logger.error({ err }, 'Feed sync cycle failed'));
  }, intervalMs);
  timer.unref();
  logger.info({ intervalMs }, 'Ingestion scheduler started (22 platforms)');
}

export function stopIngestionScheduler(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
