import { useEffect, useMemo, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   NdMED — LIWIMALA INITIATIVE · v5.0 PROTOTYPE (rebuilt from scratch)
   Single-file JSX prototype for testing. Default export: <App/>.

   ── SYSTEM ARCHITECTURE (production target — see /server, /web, /docs) ──────
     Browser SPA ──HTTPS/JSON──▶ API tier (Express/TS, stateless, N replicas)
                                    ├─▶ PostgreSQL (users·consultations·specialists)
                                    └─▶ Anthropic/Claude API  (key server-side ONLY)
     This prototype simulates that stack inside one file so the full UX can be
     exercised standalone:
       • ENGINE.mode = "mock"  → deterministic rule-based triage, zero network,
                                 zero keys. Ideal for UI/UX + KNN testing.
       • ENGINE.mode = "api"   → POST {API_BASE}/consultations against the real
                                 backend in this repo (JWT in localStorage).

   ── FILE STRUCTURE (this file mirrors the production layering) ──────────────
     §1 CONFIG        design tokens, runtime config
     §2 DATA          plans · question bank · zones · specialist directory · evidence KB
     §3 ENGINE        haversine + KNN matcher · mock triage engine · api adapter
     §4 STATE         useConsultation() — the app state machine
     §5 UI            atoms → inputs → screens → <App/>

   ── DATABASE SCHEMA (PostgreSQL / Prisma — implemented in /server/prisma) ───
     users(id, email, passwordHash, name, plan[FREE|PRO|CLINICAL], timestamps)
     consultations(id, userId→users, plan, answers jsonb, result jsonb,
                   triageColor, referralSpecialty, model, patientZone, createdAt)
     specialists(id, name, specialty, subspecialty, zone, city, lat, lng,
                 facility, address, phone, email, available, languages[], tags[])
     consultation_specialists(consultationId, specialistId, rank, score, distanceKm)

   ── API ENDPOINTS (implemented in /server, documented in /docs/API.md) ──────
     POST /api/auth/register · POST /api/auth/login · GET /api/auth/me
     GET  /api/plans · GET /api/questions · GET /api/specialists
     POST /api/specialists/match            (auth, PRO+)   — KNN only
     POST /api/consultations                (auth)         — full triage pipeline
     GET  /api/consultations[/:id]          (auth)         — history / report
     PATCH /api/users/me/plan               (auth)         — simulated upgrade

   ── UI ARCHITECTURE ─────────────────────────────────────────────────────────
     PlanWall → Landing → Intake (16-step, 8 sections) → Analyzing (pipeline)
     → Result (tabs: Overview·Conditions·Actions·Referral·Specialists[·Evidence·Labs])
     + MapModal (Google Maps embed / directions) + printable PDF report.

   ⚕️ NdMED does not replace a licensed physician. Emergencies: 15 / 112 / 911.
   ═══════════════════════════════════════════════════════════════════════════ */

/* §1 ─── CONFIG ───────────────────────────────────────────────────────────── */

const ENGINE = {
  mode: "mock",                                  // "mock" | "api"
  apiBase: "http://localhost:4000/api",          // used when mode === "api"
  tokenKey: "ndmed.token",                       // JWT storage key for api mode
  pipelineStepMs: 620,                           // analyzing-animation cadence
};

const T = {
  navy: "#07182E", navyMid: "#0D2540", card: "#0F2D4A",
  teal: "#00C9B1", tealDim: "#009E8D",
  white: "#EDF2F7", dim: "#7A99B8", dimL: "#A8BCCF",
  amber: "#F6A623", red: "#E8394A", orange: "#F6762B", green: "#21C97A", purple: "#8B5CF6",
  border: "rgba(0,201,177,0.18)", borderDim: "rgba(255,255,255,0.07)",
};

const TRIAGE = {
  RED:    { bg: T.red,    label: "EMERGENCY",   icon: "🚨", desc: "Seek immediate emergency care — call 15/112/911" },
  ORANGE: { bg: T.orange, label: "URGENT",      icon: "⚠️", desc: "See a doctor within 2–4 hours" },
  YELLOW: { bg: "#F6C623", label: "SEMI-URGENT", icon: "⚡", desc: "Consult a doctor within 24 hours" },
  GREEN:  { bg: T.green,  label: "NON-URGENT",  icon: "✅", desc: "Schedule a routine appointment" },
};

const GBL = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@keyframes ndPulse{0%{box-shadow:0 0 0 0 rgba(0,201,177,.5)}70%{box-shadow:0 0 0 9px rgba(0,0,0,0)}100%{box-shadow:0 0 0 0 rgba(0,0,0,0)}}
@keyframes ndUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes ndIn{from{opacity:0}to{opacity:1}}
@keyframes ndSpin{to{transform:rotate(360deg)}}
.nd-up{animation:ndUp .4s cubic-bezier(.22,1,.36,1) both}
.nd-in{animation:ndIn .3s ease both}
button,input{font-family:inherit}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(0,201,177,.25);border-radius:4px}
`;

/* §2 ─── DATA ─────────────────────────────────────────────────────────────── */

const PLANS = [
  { id: "free", name: "Basic", price: "Free", period: "", color: T.dimL, icon: "🩺",
    features: ["1 consultation/day", "Standard symptom triage", "Basic condition list", "Emergency referral", "Specialist directory"],
    cta: "Start Free" },
  { id: "pro", name: "Pro", price: "$9", period: "/month", color: T.teal, icon: "⚕️", badge: "Most Popular",
    features: ["Unlimited consultations", "Evidence: WHO, NIH, Mayo Clinic", "KNN specialist matching", "Google Maps navigation", "PDF report download"],
    cta: "Start Pro — $9/mo" },
  { id: "clinical", name: "Clinical", price: "$29", period: "/month", color: T.purple, icon: "🏥",
    features: ["Everything in Pro", "ICD-10/11 mapping", "Lab test recommendations", "Drug interaction alerts", "Multi-patient / EMR ready"],
    cta: "Start Clinical — $29/mo" },
];

const QUESTIONS = [
  { id: "chief", section: "Chief Complaint", type: "multi",
    q: "What is your main complaint today? (select all that apply)",
    opts: [
      "Chest pain / tightness / pressure", "Palpitations / irregular heartbeat", "Shortness of breath / dyspnea",
      "Headache / migraine", "Dizziness / vertigo / balance problems", "Confusion / memory problems",
      "Fever / chills / rigors", "Night sweats", "Unexplained weight loss",
      "Abdominal pain / cramping", "Nausea / vomiting", "Diarrhea / bloody stool", "Constipation / bloating",
      "Joint pain / arthritis", "Muscle pain / weakness / cramps", "Back pain / neck pain / spine",
      "Skin rash / itching / lesions / hives", "Swelling / edema / lymph nodes",
      "Fatigue / exhaustion / malaise", "Fainting / syncope / blackout",
      "Urinary symptoms (pain/frequency/blood)", "Sexual health / STI concern",
      "Eye problems (pain/redness/vision loss)", "Ear pain / discharge / hearing loss",
      "Throat pain / hoarseness / dysphagia", "Cough (dry or productive) / wheezing",
      "Bleeding / bruising / clotting concern", "Numbness / tingling / weakness in limbs",
      "Seizures / convulsions / loss of consciousness", "Psychiatric / mental health / mood",
      "Pregnancy concern / antenatal care", "Pediatric concern (child illness)",
      "Injury / trauma / accident", "Poisoning / toxic exposure / snake or animal bite", "Other",
    ] },
  { id: "duration", section: "Symptom Timeline", type: "single",
    q: "How long have you been experiencing these symptoms?",
    opts: ["Less than 1 hour", "1–6 hours", "6–24 hours", "1–3 days", "4–7 days", "1–2 weeks", "2–4 weeks", "1–3 months", "More than 3 months", "Chronic / recurring"] },
  { id: "severity", section: "Symptom Timeline", type: "scale", min: 1, max: 10,
    q: "Overall severity of discomfort (1 = mild, 10 = worst imaginable):" },
  { id: "onset", section: "Symptom Timeline", type: "single",
    q: "How did your symptoms begin?",
    opts: ["Sudden / explosive (within seconds)", "Rapid (within minutes)", "Acute (within hours)", "Subacute (over days)", "Gradual (weeks/months)", "Intermittent / comes and goes", "Progressive / worsening", "Following trauma or injury", "After eating / medication", "After physical exertion"] },
  { id: "pattern", section: "Symptom Timeline", type: "multi",
    q: "What makes your symptoms better or worse?",
    opts: ["Worse with movement / exertion", "Better with rest", "Worse at night", "Better in morning", "Worse after eating", "Triggered by stress / anxiety", "Worse with cold / weather change", "Relieved by medication", "Worse lying flat", "No clear pattern / constant"] },
  { id: "associated", section: "Associated Symptoms", type: "multi",
    q: "Do you have any of these accompanying symptoms? (select all)",
    opts: [
      "High fever (>38.5°C / 101°F)", "Low-grade fever (37.5–38.4°C)", "Hypothermia / feeling cold",
      "Vomiting (with or without blood)", "Diarrhea (watery / bloody)", "Jaundice (yellow skin/eyes)",
      "Severe / sudden headache", "Stiff neck (meningism)", "Photophobia (light sensitivity)",
      "Swelling of limbs / face / abdomen", "Generalized rash", "Localized redness / warmth",
      "Chest tightness / pressure", "Coughing blood (haemoptysis)", "Vomiting blood (haematemesis)",
      "Blood in urine (haematuria)", "Rectal bleeding / melaena", "Vaginal bleeding (outside period)",
      "Loss of consciousness / fainted", "Confusion / disorientation", "Slurred speech",
      "Facial drooping / arm weakness (FAST stroke)", "Sudden vision loss",
      "Difficulty breathing at rest", "Cyanosis (blue lips / fingertips)", "Rapid or irregular heartbeat",
      "Severe abdominal rigidity", "Signs of dehydration", "Paralysis / inability to move limb",
      "Severe allergic reaction (throat swelling / hives)", "None of the above",
    ] },
  { id: "history", section: "Medical History", type: "multi",
    q: "Do you have any known medical conditions?",
    opts: ["Hypertension", "Hypotension", "Type 1 Diabetes", "Type 2 Diabetes", "Asthma", "COPD / chronic bronchitis", "Tuberculosis (active or past)", "Coronary artery disease / angina", "Heart failure", "Arrhythmia / prior heart attack", "Stroke / TIA", "Epilepsy / seizure disorder", "HIV / AIDS", "Hepatitis B / C", "Malaria (recurrent)", "Chronic kidney disease", "Liver cirrhosis", "Cancer (active or remission)", "Autoimmune disease", "Thyroid disease", "Anaemia / sickle cell", "Mental health condition", "Peptic ulcer / GERD", "Pregnancy (current)", "Obesity (BMI >30)", "None known", "Prefer not to say"] },
  { id: "surgical", section: "Medical History", type: "single",
    q: "Any previous surgeries or hospitalisations?",
    opts: ["None", "Yes — within last 3 months", "Yes — within last year", "Yes — more than 1 year ago", "Yes — multiple surgeries", "Currently hospitalised / just discharged"] },
  { id: "family_hx", section: "Medical History", type: "multi",
    q: "Any significant family history?",
    opts: ["Heart disease / heart attack", "Stroke", "Cancer", "Diabetes", "Hypertension", "Sickle cell disease", "Mental illness", "Tuberculosis", "Sudden cardiac death", "None known", "Unknown"] },
  { id: "medications", section: "Medications", type: "multi",
    q: "Are you currently taking any medications?",
    opts: ["No medications", "Antihypertensives", "Antidiabetics / insulin", "Anticoagulants / blood thinners", "Antiretrovirals (ARVs)", "Antimalarials", "Antibiotics (current course)", "Anti-TB drugs", "Steroids / corticosteroids", "NSAIDs (ibuprofen, aspirin, diclofenac)", "Analgesics / opioids", "Antiepileptics", "Antidepressants / anxiolytics", "Chemotherapy / immunosuppressants", "Oral contraceptives / hormones", "Herbal / traditional medicine", "Vitamins / supplements", "Over-the-counter (self-medicated)"] },
  { id: "allergies", section: "Medications", type: "multi",
    q: "Any known drug or substance allergies?",
    opts: ["No known allergies", "Penicillin / beta-lactams", "Cephalosporins", "Sulfonamides (sulfa drugs)", "NSAIDs / aspirin / ibuprofen", "Contrast dye / iodine", "Latex / rubber", "ACE inhibitors", "Food allergy", "Environmental allergy", "Not sure / never tested"] },
  { id: "age_group", section: "Demographics", type: "single",
    q: "What is your age group?",
    opts: ["Newborn (0–28 days)", "Infant (1–11 months)", "Toddler (1–2 years)", "Child (3–11 years)", "Adolescent (12–17)", "Young adult (18–25)", "Adult (26–35)", "Adult (36–45)", "Adult (46–55)", "Senior (56–65)", "Elderly (66–75)", "Very elderly (76+)"] },
  { id: "sex", section: "Demographics", type: "single",
    q: "Biological sex (affects diagnostic probabilities):",
    opts: ["Male", "Female", "Intersex", "Prefer not to say"] },
  { id: "lifestyle", section: "Demographics", type: "multi",
    q: "Lifestyle factors (select all that apply):",
    opts: ["Current smoker", "Former smoker", "Alcohol consumption (regular)", "Illicit drug use", "Sedentary lifestyle", "High-stress occupation", "Occupational chemical / dust exposure", "Recent international travel", "Rural / remote living", "Malnutrition / food insecurity", "None of the above"] },
  { id: "location", section: "Location", type: "location",
    q: "What is your habitation zone or city? (powers KNN specialist matching)" },
  { id: "vitals", section: "Vitals", type: "vitals",
    q: "Enter available vital signs (leave blank if unknown):" },
];

const ZONE_COORDS = {
  "Yaoundé Centre": { lat: 3.8667, lng: 11.5167 }, "Yaoundé Bastos": { lat: 3.879, lng: 11.509 },
  "Yaoundé Melen": { lat: 3.855, lng: 11.52 }, "Yaoundé Biyem-Assi": { lat: 3.85, lng: 11.505 },
  "Yaoundé Essos": { lat: 3.862, lng: 11.533 }, "Douala Akwa": { lat: 4.0511, lng: 9.7085 },
  "Douala Bonapriso": { lat: 4.045, lng: 9.699 }, "Douala Deido": { lat: 4.06, lng: 9.715 },
  "Douala Bonaberi": { lat: 4.07, lng: 9.68 }, "Bafoussam Centre": { lat: 5.478, lng: 10.422 },
  "Garoua Plateau": { lat: 9.3017, lng: 13.3932 }, "Maroua Centre": { lat: 10.59, lng: 14.3159 },
  "Bamenda Mile 4": { lat: 5.9631, lng: 10.1591 }, "Ebolowa Centre": { lat: 2.9, lng: 11.15 },
  "Bertoua Centre": { lat: 4.5766, lng: 13.6845 }, "Ngaoundéré Centre": { lat: 7.3236, lng: 13.5836 },
  "Limbe Town": { lat: 4.0234, lng: 9.2087 }, "Online / Remote": { lat: 3.848, lng: 11.5021 },
};
const ZONES = Object.keys(ZONE_COORDS);

// Representative directory for prototype testing (production seeds 35 via Prisma).
const SPECIALISTS = [
  { id: "s01", name: "Dr. Ambroise FOMEKONG", specialty: "Cardiology", sub: "Interventional Cardiology", zone: "Yaoundé Centre", city: "Yaoundé", lat: 3.8667, lng: 11.5167, facility: "Hôpital Central de Yaoundé", phone: "+237 222 23 40 11", email: "a.fomekong@hcy.cm", available: "Mon–Fri 08:00–16:00", languages: ["French", "English"], tags: ["chest", "heart", "hypertension", "palpitations", "arrhythmia"] },
  { id: "s02", name: "Dr. Marie-Claire ESSOMBA", specialty: "Neurology", sub: "Stroke & Epilepsy", zone: "Yaoundé Centre", city: "Yaoundé", lat: 3.868, lng: 11.518, facility: "CHU de Yaoundé", phone: "+237 222 31 86 31", email: "mc.essomba@chuy.cm", available: "Mon–Fri 08:00–15:00", languages: ["French"], tags: ["headache", "stroke", "seizure", "numbness", "dizziness", "confusion"] },
  { id: "s03", name: "Dr. Paul NKENGASONG", specialty: "General Medicine", sub: "Internal Medicine & Triage", zone: "Yaoundé Bastos", city: "Yaoundé", lat: 3.879, lng: 11.509, facility: "Clinique Bastos", phone: "+237 222 20 57 00", email: "contact@cliniquebastos.cm", available: "Mon–Sat 07:00–20:00", languages: ["French", "English"], tags: ["general", "fever", "fatigue", "malaise", "weight"] },
  { id: "s04", name: "Dr. Christelle MANGA", specialty: "Gastroenterology", sub: "Hepatology & Digestive", zone: "Yaoundé Melen", city: "Yaoundé", lat: 3.855, lng: 11.52, facility: "Hôpital Général de Yaoundé", phone: "+237 222 23 26 42", email: "gastro@hgy.cm", available: "Tue–Sat 09:00–17:00", languages: ["French", "English"], tags: ["abdominal", "nausea", "vomiting", "diarrhea", "jaundice", "constipation"] },
  { id: "s05", name: "Dr. Jean-Baptiste OWONO", specialty: "Pneumology", sub: "Asthma, COPD & Respiratory", zone: "Yaoundé Centre", city: "Yaoundé", lat: 3.86, lng: 11.51, facility: "Centre Pasteur du Cameroun", phone: "+237 222 23 15 78", email: "pneumo@pasteur-yaounde.org", available: "Mon–Fri 08:00–16:00", languages: ["French", "English"], tags: ["breath", "cough", "asthma", "tuberculosis", "wheezing", "pneumonia"] },
  { id: "s06", name: "Dr. Sylvie ATEBA", specialty: "Pediatrics", sub: "Neonatology & Child Health", zone: "Yaoundé Biyem-Assi", city: "Yaoundé", lat: 3.85, lng: 11.505, facility: "Hôpital de la Cité Verte", phone: "+237 222 31 02 00", email: "pediatrie@cite-verte.cm", available: "Mon–Fri 07:30–18:00", languages: ["French", "English"], tags: ["child", "pediatric", "infant", "fever", "vaccination"] },
  { id: "s07", name: "Dr. Roger MBASSI", specialty: "Orthopedics & Traumatology", sub: "Joint Surgery & Spine", zone: "Yaoundé Essos", city: "Yaoundé", lat: 3.862, lng: 11.533, facility: "Croix du Sud", phone: "+237 699 45 12 78", email: "ortho@croixdusud.cm", available: "Mon–Fri 09:00–17:00", languages: ["French", "English"], tags: ["joint", "bone", "back", "trauma", "injury", "fracture", "muscle"] },
  { id: "s08", name: "Dr. Bernadette FOUDA", specialty: "Dermatology", sub: "Clinical Dermatology", zone: "Yaoundé Centre", city: "Yaoundé", lat: 3.87, lng: 11.515, facility: "Cabinet Médical Spécialisé", phone: "+237 697 23 56 89", email: "dermato@fouda.cm", available: "Mon–Fri 10:00–18:00", languages: ["French"], tags: ["skin", "rash", "itching", "hives", "lesions"] },
  { id: "s09", name: "Dr. Hélène NKOA", specialty: "Psychiatry", sub: "Mood Disorders", zone: "Yaoundé Centre", city: "Yaoundé", lat: 3.866, lng: 11.517, facility: "Hôpital Jamot", phone: "+237 222 23 09 11", email: "psychiatrie@jamot.cm", available: "Mon–Fri 08:00–15:00", languages: ["French", "English"], tags: ["mental", "anxiety", "depression", "mood", "psychiatric"] },
  { id: "s10", name: "Dr. Alain BOPDA", specialty: "Cardiology", sub: "Echocardiography & Heart Failure", zone: "Douala Akwa", city: "Douala", lat: 4.0511, lng: 9.7085, facility: "Hôpital Laquintinie", phone: "+237 233 42 22 22", email: "cardio@laquintinie.cm", available: "Mon–Fri 08:00–16:00", languages: ["French", "English"], tags: ["chest", "heart", "hypertension", "palpitations", "edema"] },
  { id: "s11", name: "Dr. Cédric EKWE", specialty: "Infectious Diseases", sub: "HIV, TB & Tropical Medicine", zone: "Douala Deido", city: "Douala", lat: 4.06, lng: 9.715, facility: "Hôpital Général de Douala", phone: "+237 233 42 56 72", email: "infect@hgd.cm", available: "Mon–Fri 08:00–16:00", languages: ["French", "English"], tags: ["fever", "malaria", "typhoid", "infection", "tuberculosis", "hiv"] },
  { id: "s12", name: "Dr. Anne-Marie TCHAMBA", specialty: "Gynecology & Obstetrics", sub: "High-Risk Pregnancy", zone: "Douala Bonapriso", city: "Douala", lat: 4.045, lng: 9.699, facility: "Clinique Sainte Thérèse", phone: "+237 699 78 23 45", email: "gyneco@ste-therese.cm", available: "Mon–Sat 08:00–18:00", languages: ["French", "English"], tags: ["pregnancy", "antenatal", "female", "gynecology", "bleeding"] },
  { id: "s13", name: "Dr. Patrice NJANKOUO", specialty: "General Surgery", sub: "Abdominal & Trauma Surgery", zone: "Douala Akwa", city: "Douala", lat: 4.053, lng: 9.705, facility: "Polyclinique la Grâce", phone: "+237 233 43 12 34", email: "surgery@lagrace.cm", available: "Mon–Sat 08:00–18:00", languages: ["French", "English"], tags: ["surgery", "abdominal", "trauma", "injury", "appendix", "bleeding"] },
  { id: "s14", name: "Dr. Samuel FONKOUA", specialty: "General Medicine", sub: "Primary Care & Infectious", zone: "Bafoussam Centre", city: "Bafoussam", lat: 5.478, lng: 10.422, facility: "Hôpital Régional de Bafoussam", phone: "+237 233 44 13 52", email: "medecine@hrb.cm", available: "Mon–Fri 07:30–16:00", languages: ["French", "English"], tags: ["general", "fever", "malaria", "typhoid", "fatigue"] },
  { id: "s15", name: "Dr. Hamidou MAÏGA", specialty: "Internal Medicine", sub: "Tropical & Infectious", zone: "Garoua Plateau", city: "Garoua", lat: 9.3017, lng: 13.3932, facility: "Hôpital Régional de Garoua", phone: "+237 222 27 11 54", email: "medecine@hrg.cm", available: "Mon–Fri 07:00–15:00", languages: ["French", "Fulfuldé"], tags: ["fever", "malaria", "meningitis", "infection", "general"] },
  { id: "s16", name: "Dr. Claudette FONGE", specialty: "Internal Medicine", sub: "Hypertension & Metabolic", zone: "Bamenda Mile 4", city: "Bamenda", lat: 5.9631, lng: 10.1591, facility: "Regional Hospital Bamenda", phone: "+237 233 36 12 09", email: "medicine@rhb.cm", available: "Mon–Fri 08:00–16:00", languages: ["English", "Pidgin"], tags: ["hypertension", "diabetes", "chest", "fatigue", "metabolic"] },
  { id: "s17", name: "Dr. Kevin TCHIO", specialty: "Telemedicine — General Practice", sub: "Remote Triage", zone: "Online / Remote", city: "Remote", lat: 3.848, lng: 11.5021, facility: "NdMED Telemedicine", phone: "+237 695 00 11 22", email: "teleconsult@ndmed.health", available: "Mon–Sun 06:00–22:00", languages: ["French", "English"], tags: ["general", "remote", "fever", "advice", "follow-up"] },
  { id: "s18", name: "Dr. Nadège BILOA", specialty: "Telemedicine — Cardiology", sub: "Remote Cardiac Monitoring", zone: "Online / Remote", city: "Remote", lat: 3.849, lng: 11.503, facility: "NdMED Telemedicine", phone: "+237 695 00 33 44", email: "cardio-tele@ndmed.health", available: "Mon–Fri 08:00–20:00", languages: ["French", "English"], tags: ["chest", "heart", "hypertension", "remote", "palpitations"] },
];

const EVIDENCE = {
  chest: [
    { title: "Chest pain: causes & red flags", source: "Mayo Clinic", url: "https://www.mayoclinic.org/symptoms/chest-pain/basics/causes/sym-20050838", relevance: "Differential for acute chest pain" },
    { title: "Warning signs of a heart attack", source: "American Heart Association", url: "https://www.heart.org/en/health-topics/heart-attack/warning-signs-of-a-heart-attack", relevance: "Emergency recognition criteria" },
  ],
  neuro: [
    { title: "Stroke symptoms (FAST)", source: "American Stroke Association", url: "https://www.stroke.org/en/about-stroke/stroke-symptoms", relevance: "FAST assessment for stroke" },
    { title: "Headache differential", source: "Mayo Clinic", url: "https://www.mayoclinic.org/symptoms/headache/basics/causes/sym-20050900", relevance: "Primary vs secondary headache" },
  ],
  fever: [
    { title: "Malaria clinical guidance", source: "WHO", url: "https://www.who.int/news-room/fact-sheets/detail/malaria", relevance: "Endemic-region febrile illness" },
    { title: "Fever management in adults", source: "NHS UK", url: "https://www.nhs.uk/conditions/fever-in-adults/", relevance: "Home care and escalation thresholds" },
  ],
  respiratory: [
    { title: "Pneumonia guidance", source: "WHO", url: "https://www.who.int/news-room/fact-sheets/detail/pneumonia", relevance: "Community-acquired pneumonia" },
    { title: "Tuberculosis fact sheet", source: "WHO", url: "https://www.who.int/news-room/fact-sheets/detail/tuberculosis", relevance: "Chronic cough evaluation" },
  ],
  abdominal: [
    { title: "Abdominal pain differential", source: "Mayo Clinic", url: "https://www.mayoclinic.org/symptoms/abdominal-pain/basics/causes/sym-20050728", relevance: "Acute abdomen assessment" },
    { title: "GI emergency signs", source: "Cleveland Clinic", url: "https://my.clevelandclinic.org/health/symptoms/4167-abdominal-pain", relevance: "Surgical vs medical abdomen" },
  ],
  general: [
    { title: "WHO health topics", source: "WHO", url: "https://www.who.int/health-topics", relevance: "Clinical guideline index" },
    { title: "MedlinePlus health topics", source: "NIH MedlinePlus", url: "https://medlineplus.gov/healthtopics.html", relevance: "Patient-facing condition guides" },
  ],
};

/* §3 ─── ENGINE ───────────────────────────────────────────────────────────── */

function haversineKm(a, b) {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Weighted KNN: specialty 40% · proximity 35% · symptom-tag overlap 25%.
function knnMatch(referralSpecialty, patientZone, chiefComplaints, k = 5) {
  const origin = ZONE_COORDS[patientZone] || ZONE_COORDS["Yaoundé Centre"];
  const spec = (referralSpecialty || "").toLowerCase();
  const words = (chiefComplaints || []).flatMap((c) => c.toLowerCase().split(/[\s/,()]+/)).filter((w) => w.length >= 3);

  return SPECIALISTS.map((sp) => {
    const isRemote = sp.zone === "Online / Remote";
    const dist = haversineKm(origin, sp);
    const geo = isRemote ? 60 : Math.max(0, 100 - dist * 0.8);

    const spSpec = sp.specialty.toLowerCase();
    let sm = 0;
    if (spSpec === spec) sm = 100;
    else if (spec && (spSpec.includes(spec) || spec.includes(spSpec.split(" ")[0]))) sm = 75;
    else if (spec && sp.sub.toLowerCase().includes(spec)) sm = 60;
    else if (/general|internal/i.test(sp.specialty)) sm = 30;
    if (isRemote) sm = Math.max(sm, 40);

    const hits = sp.tags.reduce((n, t) => n + (words.some((w) => t.includes(w) || w.includes(t)) ? 1 : 0), 0);
    const tag = Math.min(100, (hits / sp.tags.length) * 200);

    return { sp, isRemote, distanceKm: isRemote ? null : Math.round(dist), score: geo * 0.35 + sm * 0.4 + tag * 0.25 };
  })
    .filter((m) => m.score > 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}

// ── Deterministic mock triage engine ─────────────────────────────────────────
// Rule-based stand-in for the server-side Claude pipeline: same output schema,
// zero network. Red flags force RED; severity/onset drive ORANGE/YELLOW;
// chief complaints select differentials, referral specialty, and evidence.

const HARD_RED_FLAGS = [
  "Facial drooping / arm weakness (FAST stroke)", "Slurred speech", "Loss of consciousness / fainted",
  "Coughing blood (haemoptysis)", "Vomiting blood (haematemesis)", "Cyanosis (blue lips / fingertips)",
  "Difficulty breathing at rest", "Severe abdominal rigidity", "Paralysis / inability to move limb",
  "Severe allergic reaction (throat swelling / hives)", "Sudden vision loss", "Stiff neck (meningism)",
];

const COMPLAINT_MAP = [
  { match: /chest|palpitation/i, specialty: "Cardiology", evidence: "chest",
    conditions: [
      { name: "Acute coronary syndrome", probability: "High", icd10: "I24.9", icd11: "BA41", description: "Ischaemic chest pain requiring urgent ECG and troponin. Time-critical if ongoing.", source: "American Heart Association" },
      { name: "Stable angina pectoris", probability: "Moderate", icd10: "I20.9", icd11: "BA40", description: "Exertional chest tightness relieved by rest, suggesting fixed coronary stenosis.", source: "Mayo Clinic" },
      { name: "Gastro-oesophageal reflux", probability: "Low", icd10: "K21.9", icd11: "DA22", description: "Retrosternal burning worse after meals or lying flat; mimics cardiac pain.", source: "NIH MedlinePlus" },
    ] },
  { match: /headache|dizz|numb|seizure|confusion/i, specialty: "Neurology", evidence: "neuro",
    conditions: [
      { name: "Migraine", probability: "High", icd10: "G43.9", icd11: "8A80", description: "Recurrent unilateral throbbing headache with photophobia and nausea.", source: "Mayo Clinic" },
      { name: "Tension-type headache", probability: "Moderate", icd10: "G44.2", icd11: "8A81", description: "Bilateral band-like pressure associated with stress and posture.", source: "NIH MedlinePlus" },
      { name: "Meningitis (rule out)", probability: "Low", icd10: "G03.9", icd11: "1D01", description: "Fever with neck stiffness or photophobia requires urgent exclusion.", source: "WHO" },
    ] },
  { match: /fever|chills|night sweats/i, specialty: "Infectious Diseases", evidence: "fever",
    conditions: [
      { name: "Malaria", probability: "High", icd10: "B54", icd11: "1F40", description: "Cyclic fever with rigors in an endemic zone; confirm with RDT or microscopy.", source: "WHO" },
      { name: "Typhoid fever", probability: "Moderate", icd10: "A01.0", icd11: "1A07", description: "Sustained fever with abdominal discomfort and malaise over days.", source: "WHO" },
      { name: "Viral syndrome", probability: "Low", icd10: "B34.9", icd11: "1D9Z", description: "Self-limiting febrile illness with myalgia; supportive care.", source: "NHS UK" },
    ] },
  { match: /breath|cough|wheez/i, specialty: "Pneumology", evidence: "respiratory",
    conditions: [
      { name: "Community-acquired pneumonia", probability: "High", icd10: "J18.9", icd11: "CA40", description: "Productive cough with fever and dyspnea; chest X-ray confirms.", source: "WHO" },
      { name: "Asthma exacerbation", probability: "Moderate", icd10: "J45.9", icd11: "CA23", description: "Episodic wheeze and chest tightness, often trigger-related.", source: "Mayo Clinic" },
      { name: "Pulmonary tuberculosis", probability: "Low", icd10: "A15.0", icd11: "1B10", description: "Cough beyond 2 weeks with night sweats or weight loss warrants sputum testing.", source: "WHO" },
    ] },
  { match: /abdominal|nausea|vomit|diarrhea|constipation/i, specialty: "Gastroenterology", evidence: "abdominal",
    conditions: [
      { name: "Acute gastroenteritis", probability: "High", icd10: "A09", icd11: "1A40", description: "Vomiting and watery diarrhoea, usually infective; hydration is key.", source: "Cleveland Clinic" },
      { name: "Peptic ulcer disease", probability: "Moderate", icd10: "K27.9", icd11: "DA61", description: "Epigastric pain related to meals; NSAID use raises suspicion.", source: "Mayo Clinic" },
      { name: "Acute appendicitis (rule out)", probability: "Low", icd10: "K35.8", icd11: "DB10", description: "Migratory right-lower-quadrant pain with guarding needs surgical review.", source: "NIH MedlinePlus" },
    ] },
  { match: /skin|rash|itch/i, specialty: "Dermatology", evidence: "general",
    conditions: [
      { name: "Contact dermatitis", probability: "High", icd10: "L25.9", icd11: "EK00", description: "Pruritic erythematous eruption at exposure sites.", source: "Mayo Clinic" },
      { name: "Urticaria (hives)", probability: "Moderate", icd10: "L50.9", icd11: "EB05", description: "Transient wheals; watch for airway involvement.", source: "Cleveland Clinic" },
      { name: "Fungal skin infection", probability: "Low", icd10: "B36.9", icd11: "1F2D", description: "Annular scaling plaques favouring warm, moist areas.", source: "NIH MedlinePlus" },
    ] },
  { match: /injury|trauma|accident|bite/i, specialty: "General Surgery", evidence: "general",
    conditions: [
      { name: "Soft-tissue injury", probability: "High", icd10: "T14.9", icd11: "ND56", description: "Localised pain and swelling after trauma; assess function and neurovascular status.", source: "Mayo Clinic" },
      { name: "Fracture (rule out)", probability: "Moderate", icd10: "T14.2", icd11: "ND12", description: "Bony tenderness or deformity requires imaging.", source: "NIH MedlinePlus" },
      { name: "Envenomation / infected wound", probability: "Low", icd10: "T63.4", icd11: "NE61", description: "Bites need wound care, tetanus review and observation.", source: "WHO" },
    ] },
];

const DEFAULT_MAP = {
  specialty: "General Medicine", evidence: "general",
  conditions: [
    { name: "Undifferentiated systemic illness", probability: "High", icd10: "R69", icd11: "MG2A", description: "Constellation of symptoms needing structured clinical examination.", source: "WHO" },
    { name: "Viral syndrome", probability: "Moderate", icd10: "B34.9", icd11: "1D9Z", description: "Common self-limiting cause of malaise and low-grade fever.", source: "NHS UK" },
    { name: "Stress-related somatic symptoms", probability: "Low", icd10: "F45.9", icd11: "6C20", description: "Physical symptoms amplified by stress; diagnosis of exclusion.", source: "Cleveland Clinic" },
  ],
};

function mockTriage(answers, plan) {
  const chief = answers.chief || [];
  const assoc = answers.associated || [];
  const meds = answers.medications || [];
  const severity = Number(answers.severity || 5);
  const suddenOnset = /sudden|rapid/i.test(answers.onset || "");
  const pro = plan !== "free", clin = plan === "clinical";

  const redFlags = assoc.filter((a) => HARD_RED_FLAGS.includes(a));
  const softFlags = assoc.filter((a) => /high fever|blood|dehydration|irregular heartbeat/i.test(a) && !redFlags.includes(a));

  let color = "GREEN";
  if (redFlags.length) color = "RED";
  else if (severity >= 8 || (suddenOnset && severity >= 6) || softFlags.length >= 2) color = "ORANGE";
  else if (severity >= 5 || softFlags.length) color = "YELLOW";

  const chiefText = chief.join(" ");
  const map = COMPLAINT_MAP.find((m) => m.match.test(chiefText)) || DEFAULT_MAP;
  const urgency = { RED: 0, ORANGE: 3, YELLOW: 24, GREEN: 72 }[color];
  const facility = { RED: "ER", ORANGE: "Hospital", YELLOW: "Clinic", GREEN: "Primary Care" }[color];

  const interactions = [];
  if (meds.includes("Anticoagulants / blood thinners") && meds.includes("NSAIDs (ibuprofen, aspirin, diclofenac)"))
    interactions.push("Anticoagulant + NSAID: significantly increased bleeding risk — avoid NSAIDs without physician review.");
  if ((answers.allergies || []).includes("NSAIDs / aspirin / ibuprofen") && meds.includes("NSAIDs (ibuprofen, aspirin, diclofenac)"))
    interactions.push("Patient reports NSAID allergy while taking NSAIDs — stop and seek review.");
  if (meds.includes("Antimalarials") && meds.includes("Antiepileptics"))
    interactions.push("Some antimalarials lower seizure threshold and interact with antiepileptics — confirm regimen compatibility.");

  return {
    triage_level: TRIAGE[color].label,
    triage_color: color,
    triage_label: `${TRIAGE[color].label.toLowerCase()} presentation — ${map.specialty.toLowerCase()} pathway`,
    possible_conditions: map.conditions,
    red_flags: redFlags,
    immediate_actions: [
      color === "RED" ? "Call 15/112/911 or go to the nearest emergency department NOW." : `Arrange a ${facility.toLowerCase()} consultation within ${urgency || 2} hours.`,
      "Bring a written list of your current medications and allergies.",
      "Monitor and note any new or worsening symptoms (time-stamped).",
      severity >= 7 ? "Do not drive yourself — arrange transport or an ambulance." : "Rest, hydrate, and avoid strenuous activity until assessed.",
    ],
    do_not: [
      "Do not self-prescribe antibiotics or double medication doses.",
      "Do not ignore new red-flag symptoms (breathing difficulty, bleeding, confusion).",
      redFlags.length ? "Do not eat or drink until cleared by emergency staff." : "Do not delay care beyond the recommended window.",
    ],
    referral: {
      specialty: map.specialty, urgency_hours: urgency, facility_type: facility,
      rationale: `Chief complaint pattern (${chief[0] || "unspecified"}) with severity ${severity}/10${redFlags.length ? " and hard red flags" : ""} maps to the ${map.specialty} pathway.`,
    },
    first_aid: color === "RED"
      ? ["Keep the patient still, seated or lying with airway clear.", "Loosen tight clothing; nothing by mouth.", "If unresponsive and not breathing normally, start CPR and call for help."]
      : [],
    evidence_sources: pro ? [...(EVIDENCE[map.evidence] || []), ...EVIDENCE.general].slice(0, 4) : [],
    lab_tests_recommended: clin
      ? [
          { test: "Full blood count (FBC)", rationale: "Baseline for infection, anaemia and platelet status." },
          map.evidence === "fever" ? { test: "Malaria RDT / thick film", rationale: "First-line for febrile illness in an endemic zone." } : { test: "C-reactive protein (CRP)", rationale: "Non-specific inflammation marker to guide urgency." },
          map.evidence === "chest" ? { test: "ECG + troponin", rationale: "Exclude acute coronary syndrome." } : { test: "Urinalysis", rationale: "Cheap screen for infection and renal involvement." },
        ]
      : [],
    drug_interactions: clin ? interactions : [],
    clinical_notes: `Rule-based prototype assessment (mock engine): ${chief.length} chief complaint(s), severity ${severity}/10, ${redFlags.length} hard red flag(s), ${softFlags.length} soft flag(s). Production runs this step on Claude server-side with the full intake JSON.`,
    summary: color === "RED"
      ? "Your answers include emergency warning signs. Seek emergency care immediately — call 15, 112 or 911 now."
      : `Your symptoms suggest a ${TRIAGE[color].label.toLowerCase()} situation. We recommend a ${map.specialty} consultation ${urgency ? `within ${urgency} hours` : "immediately"}. Matched specialists are listed under the Specialists tab.`,
    disclaimer: "This pre-clinical assessment is AI/prototype-generated and does not constitute medical advice. Only a licensed healthcare professional can diagnose and treat. In an emergency call 15/112/911 immediately.",
  };
}

// API adapter — posts to the production backend in this repository.
async function apiTriage(answers, plan) {
  const token = localStorage.getItem(ENGINE.tokenKey);
  const res = await fetch(`${ENGINE.apiBase}/consultations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ plan, answers }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `API ${res.status}`);
  return body.consultation.result;
}

async function runTriage(answers, plan) {
  if (ENGINE.mode === "api") return apiTriage(answers, plan);
  await new Promise((r) => setTimeout(r, 400)); // let the pipeline animation breathe
  return mockTriage(answers, plan);
}

/* §4 ─── STATE ────────────────────────────────────────────────────────────── */

const PIPELINE = [
  "Parsing symptom profile", "Evaluating red-flag combinations", "Querying evidence knowledge base",
  "Computing differential diagnosis", "Scoring triage classification", "Checking medication interactions",
  "Running KNN specialist matching", "Generating referral pathway", "Compiling report",
];

function useConsultation() {
  const [stage, setStage] = useState("plans"); // plans → landing → intake → analyzing → result | error
  const [plan, setPlan] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [cur, setCur] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const q = QUESTIONS[step];

  const analyse = async (finalAnswers) => {
    setStage("analyzing");
    setError(null);
    try {
      const r = await runTriage(finalAnswers, plan);
      setResult(r);
      setStage("result");
    } catch (e) {
      setError(e.message || "Analysis failed");
      setStage("error");
    }
  };

  const next = () => {
    const optional = q.type === "vitals" || q.type === "location";
    const empty = cur == null || cur === "" || (Array.isArray(cur) && !cur.length);
    if (!optional && empty) return;
    const na = { ...answers, [q.id]: cur };
    setAnswers(na);
    setCur(null);
    if (step + 1 < QUESTIONS.length) setStep(step + 1);
    else analyse(na);
  };

  const back = () => {
    const p = step - 1;
    setStep(p);
    setCur(answers[QUESTIONS[p].id] ?? null);
  };

  const restart = () => { setStage("landing"); setStep(0); setAnswers({}); setCur(null); setResult(null); setError(null); };
  const changePlan = () => { setStage("plans"); setPlan(null); setStep(0); setAnswers({}); setCur(null); setResult(null); setError(null); };

  return { stage, setStage, plan, setPlan, step, q, answers, cur, setCur, result, error, next, back, restart, changePlan, retry: () => analyse(answers) };
}

/* §5 ─── UI ───────────────────────────────────────────────────────────────── */

const wrap = { minHeight: "100vh", background: T.navy, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "18px 12px", fontFamily: "Inter,system-ui,sans-serif" };
const panel = { width: "100%", maxWidth: 600, background: T.navyMid, border: `1px solid ${T.border}`, borderRadius: 18, padding: "22px 20px", boxShadow: "0 0 60px rgba(0,201,177,0.06)" };

const Dot = ({ size = 10, color = T.teal }) => (
  <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0, animation: "ndPulse 1.5s ease-out infinite" }} />
);
const Spinner = () => (
  <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(0,201,177,0.15)", borderTopColor: T.teal, borderRadius: "50%", animation: "ndSpin .7s linear infinite", flexShrink: 0 }} />
);
const Chip = ({ text, color = T.teal }) => (
  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", padding: "3px 8px", borderRadius: 20, background: color + "20", border: `1px solid ${color}44`, color, whiteSpace: "nowrap" }}>{text}</span>
);
const Card = ({ children, style }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", ...style }}>{children}</div>
);
const Label = ({ children, color = T.dim }) => (
  <div style={{ fontSize: 8, color, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>{children}</div>
);

function Progress({ step }) {
  const p = Math.round((step / QUESTIONS.length) * 100);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 9, color: T.dim, fontWeight: 600, letterSpacing: 1 }}>{(QUESTIONS[step]?.section || "").toUpperCase()}</span>
        <span style={{ fontSize: 9, color: T.teal, fontWeight: 700 }}>{step}/{QUESTIONS.length} ({p}%)</span>
      </div>
      <div style={{ height: 3, background: T.borderDim, borderRadius: 2 }}>
        <div style={{ height: 3, width: `${p}%`, background: `linear-gradient(90deg,${T.teal},${T.purple})`, borderRadius: 2, transition: "width .4s cubic-bezier(.22,1,.36,1)" }} />
      </div>
    </div>
  );
}

const optStyle = (sel) => ({
  width: "100%", textAlign: "left", borderRadius: 8, padding: "9px 12px", fontSize: 11, cursor: "pointer",
  border: sel ? `1.5px solid ${T.teal}` : `1px solid ${T.borderDim}`,
  background: sel ? "rgba(0,201,177,0.09)" : "rgba(255,255,255,0.025)",
  color: sel ? T.teal : T.white, fontWeight: sel ? 600 : 400, transition: "all .1s",
});

function SingleSelect({ opts, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {opts.map((o) => (
        <button key={o} onClick={() => onChange(o)} style={optStyle(value === o)}>{o}</button>
      ))}
    </div>
  );
}

function MultiSelect({ opts, value, onChange }) {
  const arr = Array.isArray(value) ? value : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {opts.map((o) => {
        const sel = arr.includes(o);
        return (
          <button key={o} onClick={() => onChange(sel ? arr.filter((x) => x !== o) : [...arr, o])} style={{ ...optStyle(sel), display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 13, height: 13, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${sel ? T.teal : "rgba(0,201,177,0.2)"}`, background: sel ? T.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: T.navy, fontWeight: 800 }}>{sel ? "✓" : ""}</span>
            {o}
          </button>
        );
      })}
      <p style={{ fontSize: 9, color: T.dim, marginTop: 3 }}>Select all that apply</p>
    </div>
  );
}

function Scale({ min, max, value, onChange }) {
  const col = (n) => (n <= 3 ? T.green : n <= 6 ? T.amber : T.red);
  return (
    <div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => {
          const sel = value === n;
          return (
            <button key={n} onClick={() => onChange(n)} style={{ width: 38, height: 38, borderRadius: 7, fontSize: 13, cursor: "pointer", border: sel ? `2px solid ${col(n)}` : `1px solid ${T.borderDim}`, background: sel ? col(n) + "1A" : "rgba(255,255,255,0.03)", color: sel ? col(n) : T.dim, fontWeight: sel ? 800 : 400 }}>{n}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
        <span style={{ color: T.green }}>1 — Mild</span><span style={{ color: T.amber }}>5 — Moderate</span><span style={{ color: T.red }}>10 — Severe</span>
      </div>
    </div>
  );
}

function VitalsForm({ value, onChange }) {
  const v = value || {};
  const fields = [
    ["bp", "Blood Pressure", "e.g. 120/80 mmHg"], ["hr", "Heart Rate", "e.g. 72 bpm"],
    ["temp", "Temperature", "e.g. 37.2 °C"], ["spo2", "SpO₂", "e.g. 98 %"],
    ["rr", "Resp. Rate", "e.g. 16 /min"], ["bgl", "Blood Glucose", "e.g. 5.5 mmol/L"],
    ["weight", "Weight (kg)", "e.g. 70"], ["height", "Height (cm)", "e.g. 175"],
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 8 }}>
        {fields.map(([k, l, ph]) => (
          <div key={k}>
            <label style={{ fontSize: 9, color: T.dim, display: "block", marginBottom: 3, fontWeight: 600 }}>{l}</label>
            <input placeholder={ph} value={v[k] || ""} onChange={(e) => onChange({ ...v, [k]: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, fontSize: 11, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.borderDim}`, color: T.white, outline: "none" }} />
          </div>
        ))}
      </div>
      <p style={{ fontSize: 9, color: T.dim, fontStyle: "italic" }}>Leave blank if unavailable.</p>
    </div>
  );
}

function LocationPicker({ value, onChange }) {
  const [search, setSearch] = useState(value || "");
  const filtered = useMemo(() => (search ? ZONES.filter((z) => z.toLowerCase().includes(search.toLowerCase())) : ZONES), [search]);
  return (
    <div>
      <input placeholder="Type your city or zone (e.g. Douala Akwa…)" value={search}
        onChange={(e) => { setSearch(e.target.value); onChange(e.target.value); }}
        style={{ width: "100%", padding: "11px 14px", borderRadius: 9, fontSize: 13, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,201,177,0.3)", color: T.white, outline: "none", marginBottom: 10 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, maxHeight: 200, overflowY: "auto" }}>
        {filtered.map((z) => (
          <button key={z} onClick={() => { onChange(z); setSearch(z); }} style={optStyle(value === z)}>{z}</button>
        ))}
      </div>
    </div>
  );
}

/* ── Screens ─────────────────────────────────────────────────────────────── */

function PlanWall({ onSelect }) {
  const [hov, setHov] = useState(null);
  return (
    <div style={{ minHeight: "100vh", background: T.navy, fontFamily: "Inter,system-ui,sans-serif", padding: "24px 14px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }} className="nd-up">
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px", borderRadius: 20, background: "rgba(0,201,177,0.12)", border: `1px solid ${T.border}`, marginBottom: 14 }}>
            <Dot size={7} /><span style={{ fontSize: 10, color: T.teal, fontWeight: 700, letterSpacing: 1.2 }}>LIWIMALA INITIATIVE · PROTOTYPE v5</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: T.white, marginBottom: 8 }}>NdMED</h1>
          <p style={{ fontSize: 12, color: T.dimL, maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}>
            Intelligent pre-clinical triage · KNN specialist matching · Maps navigation · Printable reports.
            Running the <b style={{ color: T.teal }}>{ENGINE.mode === "mock" ? "deterministic mock engine (no API key needed)" : "live API backend"}</b>.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 13, marginBottom: 20 }}>
          {PLANS.map((pl) => (
            <div key={pl.id} onMouseEnter={() => setHov(pl.id)} onMouseLeave={() => setHov(null)}
              style={{ background: pl.id === "pro" ? `linear-gradient(160deg,${T.navyMid},${T.card})` : T.card, border: `1.5px solid ${hov === pl.id ? pl.color : pl.id === "pro" ? pl.color + "44" : T.borderDim}`, borderRadius: 13, padding: "20px 16px", display: "flex", flexDirection: "column", position: "relative", transition: "all .2s", transform: hov === pl.id ? "translateY(-3px)" : "none" }}>
              {pl.badge && <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)" }}><Chip text={pl.badge} color={pl.color} /></div>}
              <div style={{ fontSize: 20, marginBottom: 7 }}>{pl.icon}</div>
              <div style={{ fontSize: 10, color: pl.color, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{pl.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 12 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: T.white }}>{pl.price}</span>
                <span style={{ fontSize: 11, color: T.dim }}>{pl.period}</span>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginBottom: 15 }}>
                {pl.features.map((f) => (
                  <div key={f} style={{ display: "flex", gap: 6, fontSize: 10, color: T.dimL }}><span style={{ color: pl.color }}>✓</span>{f}</div>
                ))}
              </div>
              <button onClick={() => onSelect(pl.id)} style={{ padding: 10, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", border: pl.id === "free" ? `1px solid ${T.border}` : "none", background: pl.id === "free" ? "transparent" : `linear-gradient(135deg,${pl.color},${pl.color}BB)`, color: pl.id === "free" ? T.dimL : pl.id === "pro" ? T.navy : T.white }}>{pl.cta}</button>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 10, color: T.dim, lineHeight: 1.7 }}>
          NdMED does not replace a licensed physician. In any emergency, call 15/112/911 immediately. Tiers are simulated in this prototype.
        </p>
      </div>
    </div>
  );
}

function Landing({ plan, onStart, onChangePlan }) {
  const pl = PLANS.find((p) => p.id === plan);
  return (
    <div style={wrap}>
      <div style={{ ...panel, textAlign: "center" }} className="nd-up">
        <div style={{ width: 52, height: 52, borderRadius: 13, background: `linear-gradient(135deg,${T.teal},${T.tealDim})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22 }}>⚕️</div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.white }}>NdMED</h1>
          {pl && <Chip text={pl.name} color={pl.color} />}
        </div>
        <div style={{ fontSize: 9, color: T.teal, letterSpacing: 2, fontWeight: 700, marginBottom: 9 }}>LIWIMALA INITIATIVE</div>
        <p style={{ fontSize: 11, color: T.dimL, maxWidth: 420, margin: "0 auto 16px", lineHeight: 1.7 }}>
          Answer {QUESTIONS.length} clinical questions across {new Set(QUESTIONS.map((x) => x.section)).size} domains.
          Receive triage with differentials, KNN specialist matching and maps navigation.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16, textAlign: "left" }}>
          {[["🧠", "AI Differential Diagnosis", "Ranked conditions with ICD codes"], ["🔍", "KNN Specialist Matching", "Specialty 40% · distance 35% · tags 25%"], ["🗺️", "Maps Navigation", "Route to the matched specialist"], ["🖨️", "PDF Report", "Printable consultation summary"]].map(([i, t, d]) => (
            <div key={t} style={{ background: T.card, border: `1px solid ${T.borderDim}`, borderRadius: 8, padding: "9px 10px" }}>
              <div style={{ fontSize: 14, marginBottom: 2 }}>{i}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.white }}>{t}</div>
              <div style={{ fontSize: 9, color: T.dim }}>{d}</div>
            </div>
          ))}
        </div>
        <button onClick={onStart} style={{ width: "100%", padding: 12, borderRadius: 9, fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg,${T.teal},${T.tealDim})`, color: T.navy, border: "none", cursor: "pointer", marginBottom: 7 }}>Begin Pre-Consultation →</button>
        <button onClick={onChangePlan} style={{ width: "100%", padding: 9, borderRadius: 9, fontSize: 10, background: "transparent", border: `1px solid ${T.borderDim}`, color: T.dim, cursor: "pointer" }}>← Change Plan</button>
        <p style={{ fontSize: 9, color: T.dim, marginTop: 10 }}>Does not replace a licensed physician. Emergencies: 15/112/911.</p>
      </div>
    </div>
  );
}

function Analyzing() {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const timers = PIPELINE.map((_, i) => setTimeout(() => setDone(i + 1), (i + 1) * ENGINE.pipelineStepMs));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div style={wrap}>
      <div style={{ ...panel, textAlign: "center" }} className="nd-in">
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0,201,177,0.1)", border: "2px solid rgba(0,201,177,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Spinner /></div>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, marginBottom: 4 }}>Analysing your profile</h2>
        <p style={{ fontSize: 10, color: T.dim, marginBottom: 18 }}>Running the {PIPELINE.length}-step clinical pipeline ({ENGINE.mode} engine).</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
          {PIPELINE.map((s, i) => {
            const ok = i < done, cur = i === done;
            return (
              <div key={s} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 11px", borderRadius: 7, background: ok ? "rgba(0,201,177,0.05)" : T.card, border: `1px solid ${ok ? T.border : T.borderDim}`, transition: "all .3s" }}>
                {cur ? <Spinner /> : ok ? <Dot size={8} /> : <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.borderDim, display: "inline-block" }} />}
                <span style={{ fontSize: 10, color: ok ? T.dimL : T.dim }}>{s}</span>
                {ok && <span style={{ marginLeft: "auto", fontSize: 9, color: T.teal }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MapModal({ sp, patientZone, onClose }) {
  const origin = ZONE_COORDS[patientZone] || ZONE_COORDS["Yaoundé Centre"];
  const isRemote = sp.zone === "Online / Remote";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(7,24,46,0.9)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: T.navyMid, border: "1px solid rgba(0,201,177,0.3)", borderRadius: 16, overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 18px", background: "#0B1F3A", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.white }}>{sp.name}</div>
            <div style={{ fontSize: 10, color: T.teal }}>📍 {sp.facility} · {sp.zone}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: T.dimL, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>
        {isRemote ? (
          <div style={{ height: 170, background: "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(0,201,177,0.1))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 38 }}>💻</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.white }}>Telemedicine Consultation</div>
            <div style={{ fontSize: 11, color: T.dim }}>Available via video / phone</div>
          </div>
        ) : (
          <iframe title="Specialist location" src={`https://maps.google.com/maps?q=${sp.lat},${sp.lng}&z=15&output=embed`} width="100%" height={260} style={{ border: "none" }} loading="lazy" />
        )}
        <div style={{ padding: "14px 18px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={`tel:${sp.phone}`} style={{ flex: 1, minWidth: 130, padding: 10, borderRadius: 9, background: `linear-gradient(135deg,${T.green},#1aa866)`, color: T.navy, textDecoration: "none", fontWeight: 700, fontSize: 12, textAlign: "center" }}>📞 {sp.phone}</a>
          <a href={`mailto:${sp.email}`} style={{ flex: 1, minWidth: 100, padding: 10, borderRadius: 9, background: "rgba(0,201,177,0.12)", border: "1px solid rgba(0,201,177,0.3)", color: T.teal, textDecoration: "none", fontWeight: 700, fontSize: 12, textAlign: "center" }}>✉ Email</a>
          {isRemote ? (
            <a href="https://meet.google.com/" target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 110, padding: 10, borderRadius: 9, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.35)", color: T.purple, textDecoration: "none", fontWeight: 700, fontSize: 12, textAlign: "center" }}>💻 Video Call</a>
          ) : (
            <a href={`https://www.google.com/maps/dir/${origin.lat},${origin.lng}/${sp.lat},${sp.lng}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 110, padding: 10, borderRadius: 9, background: "rgba(66,133,244,0.15)", border: "1px solid rgba(66,133,244,0.35)", color: "#6baaf8", textDecoration: "none", fontWeight: 700, fontSize: 12, textAlign: "center" }}>🗺 Directions</a>
          )}
        </div>
      </div>
    </div>
  );
}

function SpecialistRow({ m, onMap }) {
  const { sp, rank, distanceKm, isRemote } = m;
  const rankColor = rank === 1 ? T.amber : rank === 2 ? T.dimL : T.dim;
  return (
    <Card style={{ marginBottom: 8, padding: "13px 15px" }}>
      <div style={{ display: "flex", gap: 11 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(0,201,177,0.1)", border: "1px solid rgba(0,201,177,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            {isRemote ? "💻" : "⚕️"}
          </div>
          <div style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: "50%", background: rankColor, color: T.navy, fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{rank}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{sp.name}</span>
            {isRemote && <Chip text="TELEMEDICINE" color={T.purple} />}
          </div>
          <div style={{ fontSize: 10, color: T.teal, fontWeight: 600 }}>{sp.specialty} · {sp.sub}</div>
          <div style={{ fontSize: 10, color: T.dim, margin: "2px 0 6px" }}>
            📍 {sp.facility} · {sp.zone}
            {distanceKm != null && <span style={{ marginLeft: 6, color: T.green, fontWeight: 600 }}>~{distanceKm} km</span>}
            <span style={{ marginLeft: 6, color: T.dim }}>score {Math.round(m.score)}</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <a href={`tel:${sp.phone}`} style={{ padding: "4px 9px", borderRadius: 20, fontSize: 9, fontWeight: 700, background: "rgba(33,201,122,0.12)", border: "1px solid rgba(33,201,122,0.3)", color: T.green, textDecoration: "none" }}>📞 {sp.phone}</a>
            <button onClick={() => onMap(sp)} style={{ padding: "4px 9px", borderRadius: 20, fontSize: 9, fontWeight: 700, background: "rgba(66,133,244,0.12)", border: "1px solid rgba(66,133,244,0.3)", color: "#6baaf8", cursor: "pointer" }}>{isRemote ? "💻 Connect" : "🗺 Map / Route"}</button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function printReport(result, planName, patientZone, matches) {
  const tr = TRIAGE[result.triage_color] || TRIAGE.GREEN;
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const date = new Date().toLocaleString("en-GB");
  const conds = (result.possible_conditions || []).map((c) => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.probability)}</td><td>${esc(c.icd10 || "")}</td><td>${esc(c.description || "")}</td></tr>`).join("");
  const specs = (matches || []).map((m) => `<tr><td><b>${esc(m.sp.name)}</b><br/>${esc(m.sp.facility)}</td><td>${esc(m.sp.specialty)}</td><td>${esc(m.sp.zone)}</td><td>${esc(m.sp.phone)}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>NdMED Report</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;color:#1a2a3a;margin:24px}h1{font-size:18px}h3{font-size:11px;text-transform:uppercase;border-bottom:2px solid #00C9B1;margin:14px 0 6px;padding-bottom:3px}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e8edf2;padding:5px 7px;font-size:10px;text-align:left}th{background:#0B1F3A;color:#fff}
.banner{border-left:5px solid ${tr.bg};background:${tr.bg}12;padding:10px 13px;margin:10px 0}.note{background:#fffbf0;border:1px solid #f0dfa0;padding:8px 12px;font-size:9px;margin-top:14px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<h1>NdMED — Pre-Clinical Consultation Report <small style="color:#00796B">[${esc(planName)}]</small></h1>
<div style="font-size:9px;color:#4a6080">${esc(date)}${patientZone ? " · Zone: " + esc(patientZone) : ""} · Confidential — Patient Copy · LIWIMALA INITIATIVE</div>
<div class="banner"><b style="color:${tr.bg};font-size:16px">${tr.label}</b> — ${esc(result.triage_label || "")}<br/><span style="font-size:10px">Referral: <b>${esc(result.referral?.specialty || "")}</b> (${esc(result.referral?.facility_type || "")}${result.referral?.urgency_hours != null ? ", within " + result.referral.urgency_hours + "h" : ""})</span></div>
<p>${esc(result.summary || "")}</p>
${result.red_flags?.length ? `<h3 style="border-color:#E8394A;color:#E8394A">Red Flags</h3><ul>${result.red_flags.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
<h3>Immediate Actions</h3><ol>${(result.immediate_actions || []).map((a) => `<li>${esc(a)}</li>`).join("")}</ol>
<h3>Do Not</h3><ul>${(result.do_not || []).map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
<h3>Differential Diagnosis</h3><table><tr><th>Condition</th><th>Likelihood</th><th>ICD-10</th><th>Description</th></tr>${conds}</table>
${result.lab_tests_recommended?.length ? `<h3>Recommended Labs</h3><ul>${result.lab_tests_recommended.map((l) => `<li><b>${esc(l.test)}</b> — ${esc(l.rationale)}</li>`).join("")}</ul>` : ""}
${result.drug_interactions?.length ? `<h3 style="border-color:#F6A623;color:#b45309">Drug Interaction Alerts</h3><ul>${result.drug_interactions.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
${specs ? `<h3>Matched Specialists</h3><table><tr><th>Specialist</th><th>Specialty</th><th>Zone</th><th>Contact</th></tr>${specs}</table>` : ""}
<div class="note"><b>MEDICAL DISCLAIMER</b> — ${esc(result.disclaimer || "")}</div>
</body></html>`;
  const win = window.open("", "_blank");
  if (!win) { alert("Pop-up blocked — allow pop-ups to print the report."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 700);
}

function Result({ result, plan, patientZone, chief, onRestart }) {
  const [tab, setTab] = useState("overview");
  const [mapSp, setMapSp] = useState(null);
  const tr = TRIAGE[result.triage_color] || TRIAGE.GREEN;
  const pro = plan !== "free", clin = plan === "clinical";
  const planName = PLANS.find((p) => p.id === plan)?.name || plan;

  const matches = useMemo(
    () => (pro ? knnMatch(result.referral?.specialty || "", patientZone, chief, 5) : []),
    [result, patientZone, chief, pro],
  );

  const tabs = [
    ["overview", "Overview"], ["conditions", "Conditions"], ["actions", "Actions"], ["specialists", "🔍 Specialists"],
    ...(pro ? [["evidence", "Evidence"]] : []),
    ...(clin ? [["labs", "Labs & Drugs"]] : []),
  ];

  return (
    <div style={wrap}>
      <div style={{ ...panel, maxHeight: "94vh", overflowY: "auto" }} className="nd-up">
        {mapSp && <MapModal sp={mapSp} patientZone={patientZone} onClose={() => setMapSp(null)} />}

        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${T.borderDim}` }}>
          <span style={{ fontSize: 13 }}>⚕️</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: T.teal }}>NdMED</span>
          <Chip text={planName} />
          <span style={{ marginLeft: "auto", fontSize: 9, color: T.dim }}>Pre-Clinical Report</span>
        </div>

        <div style={{ background: `linear-gradient(135deg,${tr.bg}14,${tr.bg}06)`, border: `1.5px solid ${tr.bg}44`, borderRadius: 13, padding: "15px 17px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>{tr.icon}</span>
          <div style={{ flex: 1 }}>
            <Label>Triage</Label>
            <div style={{ fontSize: 19, fontWeight: 800, color: tr.bg, lineHeight: 1 }}>{tr.label}</div>
            <div style={{ fontSize: 10, color: T.dimL, marginTop: 2 }}>{tr.desc}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Label>Referral</Label>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.white }}>{result.referral?.facility_type}</div>
            {result.referral?.urgency_hours != null && <div style={{ fontSize: 10, color: tr.bg, fontWeight: 700 }}>Within {result.referral.urgency_hours}h</div>}
          </div>
        </div>

        <Card style={{ marginBottom: 11 }}><p style={{ fontSize: 12, color: T.white, lineHeight: 1.7 }}>{result.summary}</p></Card>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 11 }}>
          {tabs.map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding: "6px 12px", borderRadius: 7, fontSize: 10, fontWeight: 600, cursor: "pointer", border: tab === id ? `1px solid ${T.teal}` : `1px solid ${T.borderDim}`, background: tab === id ? "rgba(0,201,177,0.12)" : "transparent", color: tab === id ? T.teal : T.dim }}>{l}</button>
          ))}
        </div>

        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {!!result.red_flags?.length && (
              <div style={{ background: "rgba(232,57,74,0.08)", border: "1px solid rgba(232,57,74,0.28)", borderRadius: 11, padding: "12px 14px" }}>
                <Label color={T.red}>🚩 Red Flags Detected</Label>
                {result.red_flags.map((f) => <div key={f} style={{ fontSize: 11, color: "#f8a8ae" }}>• {f}</div>)}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              <Card><Label color={T.red}>Do NOT</Label>{(result.do_not || []).map((x) => <div key={x} style={{ fontSize: 11, color: T.dimL, margin: "3px 0" }}>• {x}</div>)}</Card>
              <Card><Label color={T.green}>First Aid</Label>{result.first_aid?.length ? result.first_aid.map((x) => <div key={x} style={{ fontSize: 11, color: T.dimL, margin: "3px 0" }}>• {x}</div>) : <i style={{ fontSize: 10, color: T.dim }}>No immediate first aid required.</i>}</Card>
            </div>
            {result.clinical_notes && (
              <Card style={{ borderColor: "rgba(139,92,246,0.22)", background: "rgba(139,92,246,0.05)" }}>
                <Label color={T.purple}>Clinical Commentary</Label>
                <p style={{ fontSize: 11, color: T.dimL, lineHeight: 1.65 }}>{result.clinical_notes}</p>
              </Card>
            )}
          </div>
        )}

        {tab === "conditions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {(result.possible_conditions || []).map((c) => {
              const pc = c.probability === "High" ? T.red : c.probability === "Moderate" ? T.orange : T.green;
              return (
                <Card key={c.name}>
                  <div style={{ display: "flex", gap: 11 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 9, background: pc + "18", border: `1px solid ${pc}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: pc }}>{c.probability === "High" ? "HIGH" : c.probability === "Moderate" ? "MOD" : "LOW"}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.white }}>{c.name}</span>
                        {c.icd10 && <Chip text={`ICD-10: ${c.icd10}`} color={T.dim} />}
                        {clin && c.icd11 && <Chip text={`ICD-11: ${c.icd11}`} color={T.purple} />}
                      </div>
                      <p style={{ fontSize: 11, color: T.dimL, lineHeight: 1.6, marginBottom: 4 }}>{c.description}</p>
                      {c.source && <span style={{ fontSize: 9, color: T.teal }}>📖 {c.source}</span>}
                    </div>
                  </div>
                </Card>
              );
            })}
            <p style={{ fontSize: 10, color: T.dim, textAlign: "center" }}>Indicative only. Only a licensed physician can diagnose.</p>
          </div>
        )}

        {tab === "actions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {(result.immediate_actions || []).map((a, i) => (
              <div key={a} style={{ display: "flex", gap: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px 13px" }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, background: "rgba(0,201,177,0.12)", border: "1px solid rgba(0,201,177,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: T.teal, flexShrink: 0 }}>{i + 1}</div>
                <span style={{ fontSize: 12, color: T.white, lineHeight: 1.55 }}>{a}</span>
              </div>
            ))}
            <Card style={{ marginTop: 4 }}>
              <Label>Referral Rationale</Label>
              <p style={{ fontSize: 11, color: T.dimL, lineHeight: 1.6 }}>{result.referral?.rationale}</p>
            </Card>
          </div>
        )}

        {tab === "specialists" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Chip text="KNN Matched" />
              {patientZone && <span style={{ fontSize: 10, color: T.dim }}>Near {patientZone}</span>}
              <span style={{ marginLeft: "auto", fontSize: 9, color: T.dim }}>{matches.length} specialists</span>
            </div>
            {!pro && <Card><p style={{ fontSize: 11, color: T.dim }}>KNN specialist matching is a <b style={{ color: T.teal }}>Pro</b> feature. Restart and pick Pro or Clinical to test it.</p></Card>}
            {matches.map((m) => <SpecialistRow key={m.sp.id} m={m} onMap={setMapSp} />)}
            {pro && (
              <div style={{ background: "rgba(0,201,177,0.05)", border: "1px solid rgba(0,201,177,0.15)", borderRadius: 8, padding: "10px 13px", fontSize: 10, color: T.dim, lineHeight: 1.6 }}>
                🔍 Score = specialty match ×0.40 + geographic proximity ×0.35 + symptom-tag overlap ×0.25 (Haversine distance from your zone centroid).
              </div>
            )}
          </div>
        )}

        {tab === "evidence" && pro && (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {(result.evidence_sources || []).map((s) => (
              <Card key={s.url}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.white }}>{s.title}</div>
                <div style={{ fontSize: 10, color: T.teal, fontWeight: 600, margin: "2px 0 4px" }}>{s.source}</div>
                <p style={{ fontSize: 11, color: T.dimL, marginBottom: 5 }}>{s.relevance}</p>
                <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, fontWeight: 600, color: T.teal, textDecoration: "none", border: "1px solid rgba(0,201,177,0.25)", borderRadius: 20, padding: "2px 9px" }}>🔗 View source</a>
              </Card>
            ))}
          </div>
        )}

        {tab === "labs" && clin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <Label color={T.purple}>Recommended Laboratory Tests</Label>
            {(result.lab_tests_recommended || []).map((l) => (
              <Card key={l.test}><div style={{ fontSize: 12, fontWeight: 700, color: T.white }}>{l.test}</div><div style={{ fontSize: 11, color: T.dimL }}>{l.rationale}</div></Card>
            ))}
            {!!result.drug_interactions?.length && (
              <>
                <Label color={T.amber}>Drug Interaction Alerts</Label>
                {result.drug_interactions.map((d) => (
                  <div key={d} style={{ background: "rgba(246,166,35,0.07)", border: "1px solid rgba(246,166,35,0.22)", borderRadius: 9, padding: "9px 12px", fontSize: 11, color: "#f0c060" }}>⚡ {d}</div>
                ))}
              </>
            )}
            {!result.drug_interactions?.length && <p style={{ fontSize: 10, color: T.dim }}>No drug interactions flagged for the reported regimen.</p>}
          </div>
        )}

        <div style={{ background: "rgba(246,166,35,0.07)", border: "1px solid rgba(246,166,35,0.22)", borderRadius: 9, padding: "10px 13px", fontSize: 10, color: "#f0c060", lineHeight: 1.7, marginTop: 12 }}>{result.disclaimer}</div>

        <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
          <button onClick={() => printReport(result, planName, patientZone, matches)} style={{ flex: 1, padding: 11, borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none", background: `linear-gradient(135deg,${T.teal},${T.tealDim})`, color: T.navy }}>⬇ PDF Report</button>
          <button onClick={onRestart} style={{ flex: 1, padding: 11, borderRadius: 9, background: "transparent", border: `1px solid ${T.borderDim}`, color: T.dim, fontSize: 11, cursor: "pointer" }}>New Consultation</button>
        </div>
      </div>
    </div>
  );
}

/* ── App ─────────────────────────────────────────────────────────────────── */

export default function App() {
  const c = useConsultation();
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [c.step]);

  return (
    <>
      <style>{GBL}</style>

      {c.stage === "plans" && <PlanWall onSelect={(p) => { c.setPlan(p); c.setStage("landing"); }} />}

      {c.stage === "landing" && <Landing plan={c.plan} onStart={() => c.setStage("intake")} onChangePlan={c.changePlan} />}

      {c.stage === "analyzing" && <Analyzing />}

      {c.stage === "error" && (
        <div style={wrap}>
          <div style={{ ...panel, textAlign: "center" }} className="nd-up">
            <div style={{ fontSize: 30, marginBottom: 10 }}>⚠️</div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: T.white, marginBottom: 6 }}>Analysis Interrupted</h2>
            <div style={{ background: "rgba(232,57,74,0.06)", border: "1px solid rgba(232,57,74,0.2)", borderRadius: 8, padding: "9px 11px", margin: "0 0 14px", fontSize: 10, color: "#f8a8ae", textAlign: "left" }}>{c.error}</div>
            <button onClick={c.retry} style={{ width: "100%", padding: 11, borderRadius: 8, fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg,${T.teal},${T.tealDim})`, color: T.navy, border: "none", cursor: "pointer", marginBottom: 6 }}>↺ Retry (answers saved)</button>
            <button onClick={c.restart} style={{ width: "100%", padding: 10, borderRadius: 8, fontSize: 11, background: "transparent", border: `1px solid ${T.borderDim}`, color: T.dim, cursor: "pointer" }}>← New Consultation</button>
          </div>
        </div>
      )}

      {c.stage === "result" && c.result && (
        <Result result={c.result} plan={c.plan} patientZone={c.answers.location || ""} chief={c.answers.chief || []} onRestart={c.restart} />
      )}

      {c.stage === "intake" && (
        <div style={wrap}>
          <div ref={scrollRef} style={{ ...panel, maxHeight: "94vh", overflowY: "auto" }} className="nd-up">
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
              <span style={{ fontSize: 12 }}>⚕️</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: T.teal }}>NdMED</span>
              <Chip text={PLANS.find((p) => p.id === c.plan)?.name || c.plan} />
              <button onClick={c.changePlan} style={{ marginLeft: "auto", fontSize: 9, color: T.dim, background: "none", border: "none", cursor: "pointer" }}>Change plan</button>
            </div>

            <Progress step={c.step} />

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: T.teal, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, padding: "2px 8px", borderRadius: 4, background: "rgba(0,201,177,0.08)", display: "inline-block" }}>{c.q.section}</div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: T.white, lineHeight: 1.45 }}>{c.q.q}</h2>
            </div>

            {c.q.type === "single" && <SingleSelect opts={c.q.opts} value={c.cur} onChange={c.setCur} />}
            {c.q.type === "multi" && <MultiSelect opts={c.q.opts} value={c.cur} onChange={c.setCur} />}
            {c.q.type === "scale" && <Scale min={c.q.min} max={c.q.max} value={c.cur} onChange={c.setCur} />}
            {c.q.type === "vitals" && <VitalsForm value={c.cur} onChange={c.setCur} />}
            {c.q.type === "location" && <LocationPicker value={c.cur || ""} onChange={c.setCur} />}

            <div style={{ display: "flex", gap: 7, marginTop: 16 }}>
              {c.step > 0 && (
                <button onClick={c.back} style={{ padding: "10px 14px", borderRadius: 8, fontSize: 11, background: "transparent", border: `1px solid ${T.borderDim}`, color: T.dim, cursor: "pointer" }}>← Back</button>
              )}
              <button onClick={c.next} style={{ flex: 1, padding: 11, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", background: `linear-gradient(135deg,${T.teal},${T.tealDim})`, color: T.navy }}>
                {c.step + 1 === QUESTIONS.length ? "Analyse My Symptoms →" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
