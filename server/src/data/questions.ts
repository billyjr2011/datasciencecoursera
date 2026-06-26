// Structured intake question bank — served to the client, used to validate answers.

export type QuestionType = "single" | "multi" | "scale" | "vitals" | "location";

export interface Question {
  id: string;
  section: string;
  q: string;
  type: QuestionType;
  opts?: string[];
  min?: number;
  max?: number;
}

export const QUESTIONS: Question[] = [
  {
    id: "chief", section: "Chief Complaint", type: "multi",
    q: "What is your main complaint today? (select all that apply)",
    opts: [
      "Chest pain / tightness / pressure", "Palpitations / irregular heartbeat", "Shortness of breath / dyspnea",
      "Headache / migraine", "Dizziness / vertigo / balance problems", "Confusion / memory problems",
      "Fever / chills / rigors", "Night sweats", "Unexplained weight loss",
      "Abdominal pain / cramping", "Nausea / vomiting", "Diarrhea / bloody stool", "Constipation / bloating",
      "Joint pain / arthritis", "Muscle pain / weakness / cramps", "Back pain / neck pain / spine",
      "Skin rash / itching / lesions / hives", "Swelling / edema / lymph node enlargement",
      "Fatigue / exhaustion / malaise", "Fainting / syncope / blackout",
      "Urinary symptoms (pain/frequency/blood)", "Sexual health / STI concern", "Vaginal / penile discharge",
      "Eye problems (pain/redness/vision loss)", "Ear pain / discharge / hearing loss", "Throat pain / hoarseness / dysphagia",
      "Nasal congestion / sinusitis / nosebleed", "Cough (dry or productive) / wheezing",
      "Bleeding / bruising / clotting concern", "Numbness / tingling / weakness in limbs",
      "Seizures / convulsions / loss of consciousness", "Psychiatric / mental health / mood disorder",
      "Dental / oral pain / gum swelling", "Pregnancy concern / antenatal care", "Pediatric concern (child illness)",
      "Injury / trauma / accident", "Poisoning / toxic exposure / snake/animal bite", "Other",
    ],
  },
  {
    id: "duration", section: "Symptom Timeline", type: "single",
    q: "How long have you been experiencing these symptoms?",
    opts: ["Less than 1 hour", "1–6 hours", "6–24 hours", "1–3 days", "4–7 days", "1–2 weeks", "2–4 weeks", "1–3 months", "More than 3 months", "Chronic / recurring condition"],
  },
  { id: "severity", section: "Symptom Timeline", type: "scale", q: "Overall severity of discomfort (1 = mild, 10 = worst imaginable):", min: 1, max: 10 },
  {
    id: "onset", section: "Symptom Timeline", type: "single",
    q: "How did your symptoms begin?",
    opts: ["Sudden / explosive (within seconds)", "Rapid (within minutes)", "Acute (within hours)", "Subacute (over days)", "Gradual / insidious (over weeks/months)", "Intermittent / comes and goes", "Progressive / worsening over time", "Following trauma or injury", "After eating / medication intake", "After physical exertion"],
  },
  {
    id: "pattern", section: "Symptom Timeline", type: "multi",
    q: "What makes your symptoms better or worse?",
    opts: ["Worse with movement / exertion", "Better with rest", "Worse at night", "Better in morning", "Worse after eating", "Triggered by stress / anxiety", "Worse with cold / weather change", "Relieved by medication", "Worse lying flat", "No clear pattern / constant"],
  },
  {
    id: "associated", section: "Associated Symptoms", type: "multi",
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
      "Severe abdominal rigidity", "Signs of dehydration (dry mouth, no urine, sunken eyes)",
      "Paralysis / inability to move limb", "Severe allergic reaction (throat swelling / hives)",
      "None of the above",
    ],
  },
  {
    id: "history", section: "Medical History", type: "multi",
    q: "Do you have any known medical conditions?",
    opts: [
      "Hypertension (high blood pressure)", "Hypotension (low blood pressure)",
      "Type 1 Diabetes", "Type 2 Diabetes", "Pre-diabetes / metabolic syndrome",
      "Asthma", "COPD / chronic bronchitis / emphysema", "Tuberculosis (active or past)",
      "Coronary artery disease / angina", "Heart failure", "Atrial fibrillation / arrhythmia", "Prior heart attack",
      "Stroke / TIA (mini-stroke)", "Epilepsy / seizure disorder",
      "HIV / AIDS", "Hepatitis B", "Hepatitis C", "Malaria (recurrent)",
      "Chronic kidney disease / renal failure", "Liver cirrhosis",
      "Cancer (active or in remission)", "Autoimmune disease (lupus, RA, etc.)",
      "Thyroid disease (hypo/hyperthyroid)", "Anaemia / blood disorder", "Sickle cell disease",
      "Mental health condition (depression, bipolar, schizophrenia)", "Dementia / Alzheimer",
      "Osteoporosis / arthritis", "Peptic ulcer / GERD", "Inflammatory bowel disease",
      "Pregnancy (current)", "Obesity (BMI >30)", "None known", "Prefer not to say",
    ],
  },
  {
    id: "surgical", section: "Medical History", type: "single",
    q: "Any previous surgeries or hospitalisations?",
    opts: ["None", "Yes — within last 3 months", "Yes — within last year", "Yes — more than 1 year ago", "Yes — multiple surgeries", "Currently hospitalised / just discharged"],
  },
  {
    id: "family_hx", section: "Medical History", type: "multi",
    q: "Any significant family history?",
    opts: ["Heart disease / heart attack", "Stroke", "Cancer (specify if known)", "Diabetes", "Hypertension", "Sickle cell disease", "Mental illness", "Tuberculosis", "Sudden cardiac death", "None known", "Unknown"],
  },
  {
    id: "medications", section: "Medications", type: "multi",
    q: "Are you currently taking any medications?",
    opts: ["No medications", "Antihypertensives (e.g. amlodipine, lisinopril)", "Antidiabetics / insulin", "Anticoagulants / blood thinners (e.g. warfarin, heparin)", "Antiretrovirals (ARVs)", "Antimalarials", "Antibiotics (current course)", "Anti-TB drugs", "Steroids / corticosteroids", "NSAIDs (ibuprofen, aspirin, diclofenac)", "Analgesics / opioids", "Antiepileptics", "Antidepressants / anxiolytics", "Chemotherapy / immunosuppressants", "Oral contraceptives / hormones", "Herbal / traditional medicine", "Vitamins / supplements", "Over-the-counter (self-medicated)"],
  },
  {
    id: "allergies", section: "Medications", type: "multi",
    q: "Any known drug or substance allergies?",
    opts: ["No known allergies", "Penicillin / amoxicillin / beta-lactams", "Cephalosporins", "Sulfonamides (sulfa drugs)", "NSAIDs / aspirin / ibuprofen", "Contrast dye / iodine", "Latex / rubber", "ACE inhibitors (e.g. lisinopril, captopril)", "Food allergy (specify if possible)", "Environmental allergy (pollen, dust, etc.)", "Not sure / never tested"],
  },
  {
    id: "age_group", section: "Demographics", type: "single",
    q: "What is your age group?",
    opts: ["Newborn (0–28 days)", "Infant (1–11 months)", "Toddler (1–2 years)", "Child (3–11 years)", "Adolescent (12–17 years)", "Young adult (18–25)", "Adult (26–35)", "Adult (36–45)", "Adult (46–55)", "Senior (56–65)", "Elderly (66–75)", "Very elderly (76+)"],
  },
  { id: "sex", section: "Demographics", type: "single", q: "Biological sex (affects diagnostic probabilities):", opts: ["Male", "Female", "Intersex", "Prefer not to say"] },
  {
    id: "pregnancy", section: "Demographics", type: "single",
    q: "Reproductive status (if applicable):",
    opts: ["Not applicable", "Not pregnant", "Pregnant — 1st trimester (0–12 weeks)", "Pregnant — 2nd trimester (13–26 weeks)", "Pregnant — 3rd trimester (27–40 weeks)", "Recently postpartum (within 6 weeks)", "Breastfeeding", "Menopause / post-menopause", "Unknown"],
  },
  {
    id: "lifestyle", section: "Demographics", type: "multi",
    q: "Lifestyle factors (select all that apply):",
    opts: ["Current smoker", "Former smoker", "Alcohol consumption (regular)", "Illicit drug use", "Sedentary lifestyle / low physical activity", "High-stress occupation or environment", "Occupational chemical / dust exposure", "Recent international travel", "Rural / remote living", "Malnutrition / food insecurity", "None of the above"],
  },
  { id: "location", section: "Location", type: "location", q: "What is your habitation zone or city? (for specialist matching)" },
  { id: "vitals", section: "Vitals", type: "vitals", q: "Enter available vital signs (leave blank if unknown):" },
];

export const SECTIONS = [...new Set(QUESTIONS.map((q) => q.section))];
