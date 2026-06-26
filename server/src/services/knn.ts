// KNN specialist matching — weighted scoring over the specialist directory.
// Feature weights: specialty match 40%, geographic proximity 35%, tag overlap 25%.

import { SpecialistSeed, ZONE_COORDS } from "../data/specialists.js";

export interface KnnMatch {
  specialist: SpecialistSeed;
  rank: number;
  score: number;
  distanceKm: number | null;
  isRemote: boolean;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function knnMatchSpecialists(
  specialists: SpecialistSeed[],
  referralSpecialty: string,
  patientZone: string,
  chiefComplaints: string[],
  k = 6,
): KnnMatch[] {
  const chiefLower = (chiefComplaints ?? []).map((c) => (c || "").toLowerCase());
  const specLower = (referralSpecialty || "").toLowerCase();
  const pCoord = ZONE_COORDS[patientZone] || ZONE_COORDS["Yaoundé Centre"];

  const scored = specialists.map((sp) => {
    let score = 0;

    // Feature 1: geographic proximity (35%)
    const distKm = haversineKm(pCoord.lat, pCoord.lng, sp.lat, sp.lng);
    const isRemote = sp.zone === "Online / Remote";
    const geoScore = isRemote ? 60 : Math.max(0, 100 - distKm * 0.8);
    score += geoScore * 0.35;

    // Feature 2: specialty match (40%)
    const spSpecLower = sp.specialty.toLowerCase();
    let specMatch = 0;
    if (spSpecLower === specLower) specMatch = 100;
    else if (specLower && (spSpecLower.includes(specLower) || specLower.includes(spSpecLower.split(" ")[0]))) specMatch = 75;
    else if (sp.subspecialty && specLower && sp.subspecialty.toLowerCase().includes(specLower)) specMatch = 60;
    else if (sp.specialty.includes("General") || sp.specialty.includes("Internal")) specMatch = 30;
    if (isRemote) specMatch = Math.max(specMatch, 40);
    score += specMatch * 0.4;

    // Feature 3: symptom-tag overlap (25%)
    let tagHits = 0;
    const tagTotal = sp.tags.length;
    for (const c of chiefLower) {
      const cWords = c.split(/[\s/,]+/);
      for (const t of sp.tags) {
        for (const w of cWords) {
          if (w.length >= 3 && (t.includes(w) || w.includes(t))) tagHits++;
        }
      }
    }
    const tagScore = tagTotal > 0 ? Math.min(100, (tagHits / tagTotal) * 200) : 0;
    score += tagScore * 0.25;

    return { specialist: sp, score, distanceKm: Math.round(distKm), isRemote };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((x) => x.score > 5)
    .slice(0, k)
    .map((x, i) => ({ ...x, rank: i + 1, distanceKm: x.isRemote ? null : x.distanceKm }));
}
