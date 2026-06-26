// Curated evidence knowledge base — maps chief complaints to trusted authority links.

export interface EvidenceSource {
  source: string;
  url: string;
  note: string;
}

export const EVIDENCE_KB: Record<string, EvidenceSource[]> = {
  general: [
    { source: "WHO", url: "https://www.who.int/health-topics", note: "WHO clinical guidelines" },
    { source: "NIH MedlinePlus", url: "https://medlineplus.gov/healthtopics.html", note: "US NLM patient guides" },
    { source: "Mayo Clinic", url: "https://www.mayoclinic.org/symptoms", note: "Symptom and disease database" },
    { source: "CDC", url: "https://www.cdc.gov/az/a.html", note: "CDC disease index" },
    { source: "NHS UK", url: "https://www.nhs.uk/conditions/", note: "NHS condition guides" },
    { source: "Cleveland Clinic", url: "https://my.clevelandclinic.org/health/diseases", note: "Cleveland Clinic library" },
  ],
  chest: [
    { source: "Mayo Clinic", url: "https://www.mayoclinic.org/symptoms/chest-pain/basics/causes/sym-20050838", note: "Chest pain differential" },
    { source: "American Heart Association", url: "https://www.heart.org/en/health-topics/heart-attack/warning-signs-of-a-heart-attack", note: "Heart attack signs" },
    { source: "NIH MedlinePlus", url: "https://medlineplus.gov/chestpain.html", note: "Chest pain emergencies" },
  ],
  neuro: [
    { source: "Mayo Clinic", url: "https://www.mayoclinic.org/symptoms/headache/basics/causes/sym-20050900", note: "Headache differential" },
    { source: "American Stroke Association", url: "https://www.stroke.org/en/about-stroke/stroke-symptoms", note: "FAST stroke criteria" },
    { source: "NIH MedlinePlus", url: "https://medlineplus.gov/neurologicaldiseases.html", note: "Neurological conditions" },
  ],
  fever: [
    { source: "WHO", url: "https://www.who.int/news-room/fact-sheets/detail/malaria", note: "Malaria clinical guidance" },
    { source: "CDC", url: "https://www.cdc.gov/malaria/about/disease.html", note: "Malaria symptoms & treatment" },
    { source: "NHS UK", url: "https://www.nhs.uk/conditions/fever-in-adults/", note: "Fever management" },
  ],
  respiratory: [
    { source: "WHO", url: "https://www.who.int/news-room/fact-sheets/detail/pneumonia", note: "WHO pneumonia guidance" },
    { source: "Mayo Clinic", url: "https://www.mayoclinic.org/symptoms/shortness-of-breath/basics/causes/sym-20050890", note: "Dyspnea differential" },
    { source: "WHO", url: "https://www.who.int/news-room/fact-sheets/detail/tuberculosis", note: "TB fact sheet" },
  ],
  abdominal: [
    { source: "Mayo Clinic", url: "https://www.mayoclinic.org/symptoms/abdominal-pain/basics/causes/sym-20050728", note: "Abdominal pain differential" },
    { source: "NIH MedlinePlus", url: "https://medlineplus.gov/abdominalpain.html", note: "Abdominal pain assessment" },
    { source: "Cleveland Clinic", url: "https://my.clevelandclinic.org/health/symptoms/4167-abdominal-pain", note: "GI emergency signs" },
  ],
  mental: [
    { source: "WHO", url: "https://www.who.int/news-room/fact-sheets/detail/mental-disorders", note: "WHO mental disorders" },
    { source: "NIH MedlinePlus", url: "https://medlineplus.gov/mentaldisorders.html", note: "Mental health conditions" },
    { source: "Cleveland Clinic", url: "https://my.clevelandclinic.org/health/diseases/9536-depression", note: "Depression assessment" },
  ],
  gyneco: [
    { source: "WHO", url: "https://www.who.int/health-topics/maternal-health", note: "WHO maternal health" },
    { source: "NIH MedlinePlus", url: "https://medlineplus.gov/pregnancycomplications.html", note: "Pregnancy complications" },
    { source: "Mayo Clinic", url: "https://www.mayoclinic.org/healthy-lifestyle/pregnancy-week-by-week/basics/healthy-pregnancy/hlv-20049471", note: "Antenatal care" },
  ],
  skin: [
    { source: "Mayo Clinic", url: "https://www.mayoclinic.org/diseases-conditions/rashes/symptoms-causes/syc-20378973", note: "Rash differential" },
    { source: "NIH MedlinePlus", url: "https://medlineplus.gov/rashes.html", note: "Skin condition guide" },
    { source: "Cleveland Clinic", url: "https://my.clevelandclinic.org/health/symptoms/21885-rash", note: "Rash types & treatment" },
  ],
  trauma: [
    { source: "WHO", url: "https://www.who.int/news-room/fact-sheets/detail/injuries", note: "Trauma & injury guidance" },
    { source: "CDC", url: "https://www.cdc.gov/injury/index.html", note: "CDC injury prevention & care" },
    { source: "Mayo Clinic", url: "https://www.mayoclinic.org/first-aid/first-aid-severe-bleeding/basics/art-20056661", note: "First aid for trauma" },
  ],
};

export function getRelevantSources(answers: Record<string, unknown>): EvidenceSource[] {
  const chief = Array.isArray(answers.chief) ? (answers.chief as string[]) : [String(answers.chief ?? "")];
  let all: EvidenceSource[] = [...EVIDENCE_KB.general];
  for (const raw of chief) {
    const c = (raw || "").toLowerCase();
    if (c.includes("chest") || c.includes("heart") || c.includes("palpitat")) all = all.concat(EVIDENCE_KB.chest);
    if (c.includes("head") || c.includes("dizz") || c.includes("neuro") || c.includes("seizure") || c.includes("stroke") || c.includes("numb")) all = all.concat(EVIDENCE_KB.neuro);
    if (c.includes("fever") || c.includes("chill") || c.includes("malaria") || c.includes("infect")) all = all.concat(EVIDENCE_KB.fever);
    if (c.includes("breath") || c.includes("cough") || c.includes("wheez") || c.includes("tubercu")) all = all.concat(EVIDENCE_KB.respiratory);
    if (c.includes("abdom") || c.includes("nausea") || c.includes("vomit") || c.includes("diarr") || c.includes("liver")) all = all.concat(EVIDENCE_KB.abdominal);
    if (c.includes("mental") || c.includes("psychiat") || c.includes("depress") || c.includes("anxiety")) all = all.concat(EVIDENCE_KB.mental);
    if (c.includes("preg") || c.includes("gynec") || c.includes("vaginal") || c.includes("menstr")) all = all.concat(EVIDENCE_KB.gyneco);
    if (c.includes("skin") || c.includes("rash") || c.includes("itch") || c.includes("lesion")) all = all.concat(EVIDENCE_KB.skin);
    if (c.includes("injur") || c.includes("trauma") || c.includes("accident") || c.includes("bite")) all = all.concat(EVIDENCE_KB.trauma);
  }
  const seen = new Set<string>();
  return all.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true))).slice(0, 9);
}
